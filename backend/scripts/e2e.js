#!/usr/bin/env node
 // Test de bout en bout de l'API : parcours complet d'un incident, droits par rôle, règles de gestion.
// Usage : DEMO_PASSWORD='...' API_URL=http://localhost:3000 node scripts/e2e.js
// Nécessite Node 20 ou plus et l'API démarrée sur une base initialisée avec les comptes de démo.
const BASE = process.env.API_URL || 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) {
    console.error('Définir DEMO_PASSWORD (mot de passe de db/init/05_seed_demo.sql)');
    process.exit(2);
}

const jars = {}; // cookies par utilisateur
let ok = 0,
    fail = 0;

async function api(user, method, path, body, raw) {
    const headers = {};
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    if (user && jars[user]) headers.Cookie = jars[user];
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' });
    const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (user && set.length) {
        const pair = set.map((c) => c.split(';')[0]).find((c) => c.startsWith('helpdesk_session='));
        if (pair) jars[user] = pair.endsWith('=') ? '' : pair;
    }
    if (raw) return { status: res.status, headers: res.headers, text: await res.text() };
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* non JSON */ }
    return { status: res.status, body: json, headers: res.headers };
}

function check(name, cond, detail) {
    if (cond) {
        ok += 1;
        console.log(`OK    ${name}`);
    } else {
        fail += 1;
        console.log(`ECHEC ${name}${detail ? ' -> ' + detail : ''}`);
    }
}
const is = (name, r, status, extra) => check(`${name} (${status})`, r.status === status && (extra === undefined || extra), `obtenu ${r.status} ${r.body ? JSON.stringify(r.body).slice(0, 160) : ''}`);

(async() => {
    const stamp = Date.now();
    // ---------- connexion des 5 rôles
    for (const u of['admin', 'superviseur', 'technicien', 'etudiant', 'enseignant']) {
        const r = await api(u, 'POST', '/api/auth/login', { email: `${u}@demo.local`, password: PASSWORD });
        is(`connexion ${u}`, r, 200);
    }
    const tech = await api('technicien', 'GET', '/api/auth/me');
    const techId = tech.body && tech.body.user && tech.body.user.id;

    // ---------- référentiels
    const cats = await api('etudiant', 'GET', '/api/categories');
    const lieux = await api('etudiant', 'GET', '/api/lieux');
    is('liste des catégories', cats, 200, Array.isArray(cats.body) && cats.body.length > 0);
    is('liste des lieux', lieux, 200, Array.isArray(lieux.body) && lieux.body.length > 0);
    const form = { titre: `Projecteur HS ${stamp}`, description: 'Ne s\'allume plus', categorie_id: cats.body[0].id, lieu_id: lieux.body[0].id, urgence: 'ELEVE' };

    // ---------- création et validation
    is('création sans titre refusée', await api('etudiant', 'POST', '/api/incidents', {...form, titre: '  ' }), 400);
    is('un superviseur ne déclare pas (RG1)', await api('superviseur', 'POST', '/api/incidents', form), 403);
    is('catégorie inconnue refusée', await api('etudiant', 'POST', '/api/incidents', {...form, categorie_id: 999999 }), 400);
    const created = await api('etudiant', 'POST', '/api/incidents', form);
    is('création d\'un incident', created, 201, created.body && created.body.statut === 'SIGNALE' && created.body.historique.length === 1);
    const id = created.body && created.body.id;

    // ---------- visibilité (RG16, RG7)
    const mine = await api('etudiant', 'GET', '/api/incidents');
    is('l\'étudiant voit son incident', mine, 200, mine.body.items.some((i) => i.id === id));
    is('un autre déclarant est refusé (RG16)', await api('enseignant', 'GET', `/api/incidents/${id}`), 403);
    is('un technicien non affecté est refusé', await api('technicien', 'GET', `/api/incidents/${id}`), 403);
    is('l\'admin consulte en lecture', await api('admin', 'GET', `/api/incidents/${id}`), 200);
    is('incident inexistant', await api('superviseur', 'GET', '/api/incidents/999999999'), 404);
    is('identifiant invalide', await api('superviseur', 'GET', '/api/incidents/abc'), 400);
    const search = await api('superviseur', 'GET', `/api/incidents?q=${encodeURIComponent('Projecteur HS ' + stamp)}&statut=SIGNALE`);
    is('recherche par mot-clé et filtre de statut', search, 200, search.body.items.some((i) => i.id === id));

    // ---------- parcours du superviseur
    is('un étudiant ne peut pas examiner (RG6)', await api('etudiant', 'POST', `/api/incidents/${id}/examiner`, {}), 403);
    is('rejet sans motif refusé (RG13)', await api('superviseur', 'POST', `/api/incidents/${id}/rejeter`, {}), 400);
    is('affectation avant examen refusée', await api('superviseur', 'POST', `/api/incidents/${id}/affecter`, { technicien_id: techId }), 409);
    const exam = await api('superviseur', 'POST', `/api/incidents/${id}/examiner`, {});
    is('examen de l\'incident', exam, 200, exam.body.statut === 'EXAMINE');
    is('deuxième examen refusé', await api('superviseur', 'POST', `/api/incidents/${id}/examiner`, {}), 409);
    const techs = await api('superviseur', 'GET', '/api/techniciens');
    is('liste des techniciens avec charge', techs, 200, techs.body.some((t) => t.id === techId && typeof t.charge === 'number'));
    const aff = await api('superviseur', 'POST', `/api/incidents/${id}/affecter`, { technicien_id: techId });
    is('affectation à un technicien disponible', aff, 200, aff.body.statut === 'AFFECTE' && aff.body.affectation_active.technicien_id === techId);
    is('un superviseur ne prend pas en charge', await api('superviseur', 'POST', `/api/incidents/${id}/prendre-en-charge`), 403);

    // ---------- parcours du technicien
    is('le technicien voit son incident', await api('technicien', 'GET', `/api/incidents/${id}`), 200);
    is('résolution avant prise en charge refusée', await api('technicien', 'POST', `/api/incidents/${id}/resoudre`, {}), 409);
    const take = await api('technicien', 'POST', `/api/incidents/${id}/prendre-en-charge`);
    is('prise en charge', take, 200, take.body.statut === 'EN_COURS');
    is('non résolu sans remarque refusé (RG8)', await api('technicien', 'POST', `/api/incidents/${id}/non-resolu`, {}), 400);
    const done = await api('technicien', 'POST', `/api/incidents/${id}/resoudre`, { remarque: 'Lampe remplacée' });
    is('résolution', done, 200, done.body.statut === 'RESOLU');

    // ---------- notifications (BF18)
    const notif = await api('etudiant', 'GET', '/api/notifications');
    is('le déclarant est notifié', notif, 200, notif.body.non_lues >= 1);
    is('tout marquer comme lu', await api('etudiant', 'POST', '/api/notifications/lues'), 200);
    const notif2 = await api('etudiant', 'GET', '/api/notifications?non_lues=1');
    is('plus de notification non lue', notif2, 200, notif2.body.non_lues === 0);

    // ---------- clôture (RG11)
    const closed = await api('superviseur', 'POST', `/api/incidents/${id}/cloturer`, {});
    is('clôture', closed, 200, closed.body.statut === 'CLOTURE' && closed.body.historique.length === 6);
    is('incident clôturé non modifiable (RG11)', await api('superviseur', 'POST', `/api/incidents/${id}/cloturer`, {}), 409);
    is('incident clôturé non réaffectable', await api('superviseur', 'POST', `/api/incidents/${id}/reaffecter`, { technicien_id: techId }), 409);

    // ---------- rejet et doublon
    const second = await api('etudiant', 'POST', '/api/incidents', {...form, titre: `Doublon ${stamp}` });
    const id2 = second.body.id;
    const dup = await api('superviseur', 'POST', `/api/incidents/${id2}/doublon`, { doublon_de_id: id });
    is('doublon clôturé avec référence', dup, 200, dup.body.statut === 'CLOTURE' && dup.body.doublon_de_id === id);
    const third = await api('etudiant', 'POST', '/api/incidents', {...form, titre: `Rejet ${stamp}` });
    const rej = await api('superviseur', 'POST', `/api/incidents/${third.body.id}/rejeter`, { motif: 'Hors périmètre' });
    is('rejet avec motif', rej, 200, rej.body.statut === 'CLOTURE');

    // ---------- non résolu, réouverture, réaffectation (RG12, RG14)
    const fourth = await api('enseignant', 'POST', '/api/incidents', {...form, titre: `Non résolu ${stamp}` });
    const id4 = fourth.body.id;
    await api('superviseur', 'POST', `/api/incidents/${id4}/examiner`, {});
    await api('superviseur', 'POST', `/api/incidents/${id4}/affecter`, { technicien_id: techId });
    await api('technicien', 'POST', `/api/incidents/${id4}/prendre-en-charge`);
    const re = await api('superviseur', 'POST', `/api/incidents/${id4}/reaffecter`, { technicien_id: techId, remarque: 'Technicien indisponible' });
    is('réaffectation d\'un incident en cours (RG14)', re, 200, re.body.statut === 'AFFECTE');
    await api('technicien', 'POST', `/api/incidents/${id4}/prendre-en-charge`);
    const nr = await api('technicien', 'POST', `/api/incidents/${id4}/non-resolu`, { remarque: 'Pièce introuvable' });
    is('non résolu avec remarque', nr, 200, nr.body.statut === 'NON_RESOLU');
    const reopen = await api('superviseur', 'POST', `/api/incidents/${id4}/rouvrir`, { technicien_id: techId });
    is('réouverture d\'un incident non résolu (RG12)', reopen, 200, reopen.body.statut === 'AFFECTE');

    // ---------- disponibilité du technicien (RG5)
    const fifth = await api('etudiant', 'POST', '/api/incidents', {...form, titre: `Indisponible ${stamp}` });
    await api('superviseur', 'POST', `/api/incidents/${fifth.body.id}/examiner`, {});
    is('technicien indisponible', await api('technicien', 'PATCH', '/api/techniciens/moi', { disponible: false }), 200);
    is('affectation à un indisponible refusée (RG5)', await api('superviseur', 'POST', `/api/incidents/${fifth.body.id}/affecter`, { technicien_id: techId }), 409);
    is('technicien de nouveau disponible', await api('technicien', 'PATCH', '/api/techniciens/moi', { disponible: true }), 200);

    // ---------- pièce jointe (RG17)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const photoInc = await api('etudiant', 'POST', '/api/incidents', {...form, titre: `Photo ${stamp}` });
    const fd = new FormData();
    fd.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
    const up = await api('etudiant', 'POST', `/api/incidents/${photoInc.body.id}/piece-jointe`, fd);
    is('ajout d\'une photo PNG', up, 201, up.body.type_mime === 'image/png');
    const got = await api('etudiant', 'GET', `/api/incidents/${photoInc.body.id}/piece-jointe`, undefined, true);
    check('lecture de la photo par le déclarant (200, image/png)', got.status === 200 && /image\/png/.test(got.headers.get('content-type') || ''), `obtenu ${got.status}`);
    is('photo refusée à un autre déclarant', await api('enseignant', 'GET', `/api/incidents/${photoInc.body.id}/piece-jointe`), 403);
    const bad = new FormData();
    bad.append('photo', new Blob(['pas une image'], { type: 'image/png' }), 'faux.png');
    is('photo ajoutée sur un incident clôturé refusée', await api('etudiant', 'POST', `/api/incidents/${third.body.id}/piece-jointe`, bad), 409);
    const sixth = await api('etudiant', 'POST', '/api/incidents', {...form, titre: `Fichier ${stamp}` });
    is('contenu non image refusé (RG17)', await api('etudiant', 'POST', `/api/incidents/${sixth.body.id}/piece-jointe`, bad), 400);

    // ---------- statistiques et export (BF20 à BF22)
    const stats = await api('superviseur', 'GET', '/api/statistiques');
    is('statistiques', stats, 200, stats.body.total >= 6 && typeof stats.body.delai_moyen_resolution_heures === 'number' && Array.isArray(stats.body.charge_par_technicien));
    const csv = await api('superviseur', 'GET', '/api/statistiques/export.csv', undefined, true);
    check('export CSV', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type') || '') && csv.text.includes(`Projecteur HS ${stamp}`), `obtenu ${csv.status}`);
    is('statistiques interdites à un étudiant', await api('etudiant', 'GET', '/api/statistiques'), 403);

    // ---------- administration (BF3, RG15, RG19)
    const email = `test.${stamp}@demo.local`;
    const newUser = await api('admin', 'POST', '/api/admin/utilisateurs', { nom: 'Test', prenom: 'Auto', email, role: 'technicien', mot_de_passe: 'Mot-de-passe-1234' });
    is('création d\'un compte par l\'admin', newUser, 201, newUser.body.role === 'technicien');
    is('e-mail déjà utilisé', await api('admin', 'POST', '/api/admin/utilisateurs', { nom: 'Test', prenom: 'Auto', email, role: 'etudiant', mot_de_passe: 'Mot-de-passe-1234' }), 409);
    is('mot de passe trop court refusé', await api('admin', 'POST', '/api/admin/utilisateurs', { nom: 'T', prenom: 'T', email: `x${stamp}@demo.local`, role: 'etudiant', mot_de_passe: 'court' }), 400);
    is('le nouveau compte se connecte', await api('nouveau', 'POST', '/api/auth/login', { email, password: 'Mot-de-passe-1234' }), 200);
    is('désactivation du compte', await api('admin', 'PATCH', `/api/admin/utilisateurs/${newUser.body.id}`, { actif: false }), 200);
    is('compte désactivé refusé à la connexion (RG15)', await api('nouveau2', 'POST', '/api/auth/login', { email, password: 'Mot-de-passe-1234' }), 403);
    is('session d\'un compte désactivé invalidée', await api('nouveau', 'GET', '/api/auth/me'), 401);
    const me = await api('admin', 'GET', '/api/auth/me');
    is('l\'admin ne peut pas se désactiver', await api('admin', 'PATCH', `/api/admin/utilisateurs/${me.body.user.id}`, { actif: false }), 409);
    is('un étudiant n\'accède pas à l\'administration', await api('etudiant', 'GET', '/api/admin/utilisateurs'), 403);
    const lieu = await api('admin', 'POST', '/api/admin/lieux', { libelle: `Salle test ${stamp}` });
    is('création d\'un lieu', lieu, 201);
    is('désactivation d\'un lieu', await api('admin', 'PATCH', `/api/admin/lieux/${lieu.body.id}`, { actif: false }), 200);
    const lieuxApres = await api('etudiant', 'GET', '/api/lieux');
    check('un lieu désactivé disparaît du formulaire', !lieuxApres.body.some((l) => l.id === lieu.body.id));

    // ---------- déconnexion
    is('déconnexion', await api('etudiant', 'POST', '/api/auth/logout'), 200);
    is('session terminée', await api('etudiant', 'GET', '/api/incidents'), 401);

    console.log(`\n${ok} réussis, ${fail} en échec`);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.error('Erreur du script :', e.message);
    process.exit(2);
});