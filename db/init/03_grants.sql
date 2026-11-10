GRANT CONNECT ON DATABASE helpdesk TO helpdesk_app;
GRANT USAGE ON SCHEMA public TO helpdesk_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO helpdesk_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO helpdesk_app;
-- Tables de référence et historique : lecture / ajout seulement
REVOKE INSERT, UPDATE ON role, transition_autorisee FROM helpdesk_app;
REVOKE UPDATE ON historique_statut FROM helpdesk_app;
