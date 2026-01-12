-- Limpiar registros obsoletos de ticket_config que no tienen company_id
DELETE FROM ticket_config WHERE company_id IS NULL;