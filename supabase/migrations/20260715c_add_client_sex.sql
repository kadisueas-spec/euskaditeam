-- Las fórmulas de DW4/JP3/YUHASZ6/JP7 necesitan sexo (además de edad, que
-- ya se puede derivar de clients.birth_date) — no existía ningún campo de
-- sexo en toda la base. Nullable: no hay forma de saberlo retroactivo para
-- los clientes ya cargados, así que el coach lo completa la primera vez
-- que hace una evaluación (mismo patrón que la altura: se pregunta una
-- vez, después se precarga).
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase.

alter table public.clients
  add column sex text check (sex in ('male', 'female'));
