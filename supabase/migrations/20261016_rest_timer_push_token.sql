-- Push al terminar el descanso (oct-2026): token del aviso programado más
-- reciente del cliente. Cada vez que arranca/ajusta el temporizador se
-- guarda un token nuevo; el aviso programado solo se manda si al llegar a
-- 0:00 el token sigue siendo el suyo (si el cliente sumó/restó tiempo,
-- salteó, completó otra serie o vio el 0:00 con la app abierta, el token
-- cambió o quedó en NULL y el aviso viejo se descarta). Ver
-- app/client/log-workout/rest-push-actions.ts.
--
-- Sin policies nuevas: el cliente ya puede hacer UPDATE de su propia fila
-- de clients (lo usan las preferencias del temporizador), y la lectura del
-- token al momento de mandar el aviso usa el service role.
alter table public.clients
  add column if not exists rest_timer_push_token uuid;
