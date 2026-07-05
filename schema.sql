-- ============================================================
-- FitCoach — Schema real de producción (dump generado con pg_dump
-- --schema-only, no un archivo mantenido a mano). Reemplaza a los dos
-- schema.sql anteriores que habían quedado desactualizados respecto a
-- la base real (les faltaban monthly_goals, monthly_reviews,
-- push_subscriptions, invite_codes, workout_set_logs, entre otras).
--
-- Para regenerarlo:
--   pg_dump "<connection string>" --schema-only --schema=public \
--     --no-owner --no-privileges -f schema.sql
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict pdYw84uqTraHpcKkIuP7p2OeTtcbdX3ZIr2bwKVyaftmdL8xPkPA3mpbUx059Oc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: claim_invite_code(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_invite_code(code_input text, user_id_input uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count int;
  v_role text;
  v_coach_id uuid;
begin
  update invite_codes
  set used_by = user_id_input, used_at = now()
  where code = code_input and used_by is null
  returning role, created_by into v_role, v_coach_id;

  get diagnostics v_count = row_count;

  if v_count > 0 and v_role = 'client' and v_coach_id is not null then
    insert into public.clients (user_id, coach_id)
    values (user_id_input, v_coach_id)
    on conflict (user_id) do nothing;
  end if;

  return v_count > 0;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: validate_invite_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_invite_code(code_input text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_role text;
begin
  select role into v_role
  from invite_codes
  where code = code_input and used_by is null;

  return v_role;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    coach_id uuid,
    birth_date date,
    weight_kg numeric(5,2),
    height_cm integer,
    goal text,
    training_experience text,
    notes_coach text,
    is_active boolean DEFAULT true,
    stripe_customer_id text,
    subscription_status text DEFAULT 'inactive'::text,
    subscription_end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stripe_subscription_id text,
    stripe_price_id text,
    payment_method text,
    CONSTRAINT clients_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'transfer'::text, 'paypal'::text]))),
    CONSTRAINT clients_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'inactive'::text, 'past_due'::text, 'canceled'::text, 'trialing'::text]))),
    CONSTRAINT clients_training_experience_check CHECK ((training_experience = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])))
);


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    coach_id uuid,
    name text NOT NULL,
    description text,
    video_url text,
    video_thumbnail_url text,
    muscle_group text,
    secondary_muscles text[],
    equipment text,
    movement_pattern text,
    technique_tips text,
    common_mistakes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    coach_id uuid,
    client_id uuid,
    workout_log_id uuid,
    routine_exercise_id uuid,
    type text,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feedback_type_check CHECK ((type = ANY (ARRAY['correction'::text, 'tip'::text, 'encouragement'::text, 'general'::text, 'weight_adjustment'::text])))
);


--
-- Name: invite_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_codes (
    code text NOT NULL,
    role text DEFAULT 'client'::text NOT NULL,
    created_by uuid,
    used_by uuid,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invite_codes_role_check CHECK ((role = ANY (ARRAY['client'::text, 'coach'::text])))
);


--
-- Name: monthly_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_goals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    month date NOT NULL,
    main_goal text NOT NULL,
    weight_kg numeric,
    motivation_level integer,
    improve_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT monthly_goals_motivation_level_check CHECK (((motivation_level >= 1) AND (motivation_level <= 5)))
);


--
-- Name: monthly_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_reviews (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    coach_id uuid,
    month date NOT NULL,
    summary text,
    next_month_goals text,
    plan_adjustments text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['coach'::text, 'client'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: routine_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routine_days (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    routine_id uuid,
    day_number integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: routine_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routine_exercises (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    day_id uuid,
    exercise_id uuid,
    order_index integer NOT NULL,
    sets integer NOT NULL,
    reps_min integer,
    reps_max integer,
    rir_target integer,
    rest_seconds integer,
    weight_suggestion text,
    coach_notes text,
    is_optional boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: routines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routines (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid,
    coach_id uuid,
    name text NOT NULL,
    description text,
    objective text,
    duration_weeks integer,
    is_active boolean DEFAULT true,
    starts_at date,
    ends_at date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: set_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.set_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workout_log_id uuid,
    routine_exercise_id uuid,
    set_number integer NOT NULL,
    weight_kg numeric(6,2),
    reps integer,
    rir integer,
    tempo text,
    client_notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT set_logs_rir_check CHECK (((rir >= 0) AND (rir <= 10)))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid,
    stripe_subscription_id text NOT NULL,
    stripe_price_id text,
    status text NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workout_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid,
    routine_day_id uuid,
    workout_date date DEFAULT CURRENT_DATE NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    overall_feeling integer,
    energy_level integer,
    client_notes text,
    is_completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workout_logs_energy_level_check CHECK (((energy_level >= 1) AND (energy_level <= 5))),
    CONSTRAINT workout_logs_overall_feeling_check CHECK (((overall_feeling >= 1) AND (overall_feeling <= 5)))
);


--
-- Name: workout_set_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_set_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workout_log_id uuid NOT NULL,
    routine_exercise_id uuid,
    set_number integer NOT NULL,
    weight_kg numeric,
    reps_completed integer,
    rir_actual integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clients clients_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: clients clients_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_key UNIQUE (user_id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: invite_codes invite_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_pkey PRIMARY KEY (code);


--
-- Name: monthly_goals monthly_goals_client_id_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_goals
    ADD CONSTRAINT monthly_goals_client_id_month_key UNIQUE (client_id, month);


--
-- Name: monthly_goals monthly_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_goals
    ADD CONSTRAINT monthly_goals_pkey PRIMARY KEY (id);


--
-- Name: monthly_reviews monthly_reviews_client_id_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reviews
    ADD CONSTRAINT monthly_reviews_client_id_month_key UNIQUE (client_id, month);


--
-- Name: monthly_reviews monthly_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reviews
    ADD CONSTRAINT monthly_reviews_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: routine_days routine_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_days
    ADD CONSTRAINT routine_days_pkey PRIMARY KEY (id);


--
-- Name: routine_exercises routine_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_exercises
    ADD CONSTRAINT routine_exercises_pkey PRIMARY KEY (id);


--
-- Name: routines routines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_pkey PRIMARY KEY (id);


--
-- Name: set_logs set_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: workout_logs workout_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_pkey PRIMARY KEY (id);


--
-- Name: workout_set_logs workout_set_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_set_logs
    ADD CONSTRAINT workout_set_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_clients_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_coach_id ON public.clients USING btree (coach_id);


--
-- Name: idx_clients_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id);


--
-- Name: idx_exercises_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercises_coach_id ON public.exercises USING btree (coach_id);


--
-- Name: idx_feedback_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_client_id ON public.feedback USING btree (client_id);


--
-- Name: idx_feedback_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_unread ON public.feedback USING btree (client_id, is_read) WHERE (is_read = false);


--
-- Name: idx_routine_days_routine_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routine_days_routine_id ON public.routine_days USING btree (routine_id);


--
-- Name: idx_routine_exercises_day_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routine_exercises_day_id ON public.routine_exercises USING btree (day_id);


--
-- Name: idx_routines_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routines_client_id ON public.routines USING btree (client_id);


--
-- Name: idx_set_logs_workout_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_set_logs_workout_log_id ON public.set_logs USING btree (workout_log_id);


--
-- Name: idx_workout_logs_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workout_logs_client_id ON public.workout_logs USING btree (client_id);


--
-- Name: idx_workout_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workout_logs_date ON public.workout_logs USING btree (workout_date DESC);


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: exercises update_exercises_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: routines update_routines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: clients clients_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: clients clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: exercises exercises_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: feedback feedback_routine_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_routine_exercise_id_fkey FOREIGN KEY (routine_exercise_id) REFERENCES public.routine_exercises(id) ON DELETE SET NULL;


--
-- Name: feedback feedback_workout_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_workout_log_id_fkey FOREIGN KEY (workout_log_id) REFERENCES public.workout_logs(id) ON DELETE SET NULL;


--
-- Name: invite_codes invite_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: invite_codes invite_codes_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_used_by_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id);


--
-- Name: monthly_goals monthly_goals_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_goals
    ADD CONSTRAINT monthly_goals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: monthly_reviews monthly_reviews_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reviews
    ADD CONSTRAINT monthly_reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: monthly_reviews monthly_reviews_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reviews
    ADD CONSTRAINT monthly_reviews_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: routine_days routine_days_routine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_days
    ADD CONSTRAINT routine_days_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE CASCADE;


--
-- Name: routine_exercises routine_exercises_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_exercises
    ADD CONSTRAINT routine_exercises_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.routine_days(id) ON DELETE CASCADE;


--
-- Name: routine_exercises routine_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_exercises
    ADD CONSTRAINT routine_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE SET NULL;


--
-- Name: routines routines_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: routines routines_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: set_logs set_logs_routine_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_routine_exercise_id_fkey FOREIGN KEY (routine_exercise_id) REFERENCES public.routine_exercises(id) ON DELETE SET NULL;


--
-- Name: set_logs set_logs_workout_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_workout_log_id_fkey FOREIGN KEY (workout_log_id) REFERENCES public.workout_logs(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: workout_logs workout_logs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: workout_logs workout_logs_routine_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_routine_day_id_fkey FOREIGN KEY (routine_day_id) REFERENCES public.routine_days(id) ON DELETE SET NULL;


--
-- Name: workout_set_logs workout_set_logs_routine_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_set_logs
    ADD CONSTRAINT workout_set_logs_routine_exercise_id_fkey FOREIGN KEY (routine_exercise_id) REFERENCES public.routine_exercises(id);


--
-- Name: workout_set_logs workout_set_logs_workout_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_set_logs
    ADD CONSTRAINT workout_set_logs_workout_log_id_fkey FOREIGN KEY (workout_log_id) REFERENCES public.workout_logs(id) ON DELETE CASCADE;


--
-- Name: feedback Client can mark feedback as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client can mark feedback as read" ON public.feedback FOR UPDATE USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: clients Client can update own stripe fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client can update own stripe fields" ON public.clients FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: monthly_goals Client manages own monthly goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client manages own monthly goals" ON public.monthly_goals USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid())))) WITH CHECK ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: push_subscriptions Client manages own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client manages own push subscriptions" ON public.push_subscriptions USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid())))) WITH CHECK ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: set_logs Client manages own set logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client manages own set logs" ON public.set_logs USING ((workout_log_id IN ( SELECT workout_logs.id
   FROM public.workout_logs
  WHERE (workout_logs.client_id IN ( SELECT clients.id
           FROM public.clients
          WHERE (clients.user_id = auth.uid()))))));


--
-- Name: workout_set_logs Client manages own set logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client manages own set logs" ON public.workout_set_logs USING ((workout_log_id IN ( SELECT workout_logs.id
   FROM public.workout_logs
  WHERE (workout_logs.client_id IN ( SELECT clients.id
           FROM public.clients
          WHERE (clients.user_id = auth.uid()))))));


--
-- Name: workout_logs Client manages own workout logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client manages own workout logs" ON public.workout_logs USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: feedback Client views own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client views own feedback" ON public.feedback FOR SELECT USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: monthly_reviews Client views own monthly reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client views own monthly reviews" ON public.monthly_reviews FOR SELECT USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: routines Client views own routine; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client views own routine" ON public.routines FOR SELECT USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: routine_days Client views own routine days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client views own routine days" ON public.routine_days FOR SELECT USING ((routine_id IN ( SELECT r.id
   FROM (public.routines r
     JOIN public.clients c ON ((c.id = r.client_id)))
  WHERE (c.user_id = auth.uid()))));


--
-- Name: routine_exercises Client views own routine exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client views own routine exercises" ON public.routine_exercises FOR SELECT USING ((day_id IN ( SELECT rd.id
   FROM ((public.routine_days rd
     JOIN public.routines r ON ((r.id = rd.routine_id)))
     JOIN public.clients c ON ((c.id = r.client_id)))
  WHERE (c.user_id = auth.uid()))));


--
-- Name: exercises Clients can view exercises from their coach; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can view exercises from their coach" ON public.exercises FOR SELECT USING ((coach_id IN ( SELECT clients.coach_id
   FROM public.clients
  WHERE (clients.user_id = auth.uid()))));


--
-- Name: clients Coach can manage their clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach can manage their clients" ON public.clients USING ((coach_id = auth.uid()));


--
-- Name: clients Coach can view their clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach can view their clients" ON public.clients FOR SELECT USING (((coach_id = auth.uid()) OR (user_id = auth.uid())));


--
-- Name: profiles Coach can view their clients profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach can view their clients profiles" ON public.profiles FOR SELECT USING ((id IN ( SELECT clients.user_id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid()))));


--
-- Name: monthly_reviews Coach manages client monthly reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages client monthly reviews" ON public.monthly_reviews USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid())))) WITH CHECK ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid()))));


--
-- Name: feedback Coach manages feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages feedback" ON public.feedback USING ((coach_id = auth.uid()));


--
-- Name: routine_days Coach manages routine days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages routine days" ON public.routine_days USING ((routine_id IN ( SELECT routines.id
   FROM public.routines
  WHERE (routines.coach_id = auth.uid()))));


--
-- Name: routine_exercises Coach manages routine exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages routine exercises" ON public.routine_exercises USING ((day_id IN ( SELECT rd.id
   FROM (public.routine_days rd
     JOIN public.routines r ON ((r.id = rd.routine_id)))
  WHERE (r.coach_id = auth.uid()))));


--
-- Name: routines Coach manages routines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages routines" ON public.routines USING ((coach_id = auth.uid()));


--
-- Name: exercises Coach manages their exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages their exercises" ON public.exercises USING ((coach_id = auth.uid()));


--
-- Name: monthly_goals Coach views client monthly goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views client monthly goals" ON public.monthly_goals FOR SELECT USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid()))));


--
-- Name: workout_set_logs Coach views client set logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views client set logs" ON public.workout_set_logs FOR SELECT USING ((workout_log_id IN ( SELECT wl.id
   FROM (public.workout_logs wl
     JOIN public.clients c ON ((c.id = wl.client_id)))
  WHERE (c.coach_id = auth.uid()))));


--
-- Name: workout_logs Coach views client workout logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views client workout logs" ON public.workout_logs FOR SELECT USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid()))));


--
-- Name: set_logs Coach views set logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views set logs" ON public.set_logs FOR SELECT USING ((workout_log_id IN ( SELECT workout_logs.id
   FROM public.workout_logs
  WHERE (workout_logs.client_id IN ( SELECT clients.id
           FROM public.clients
          WHERE (clients.coach_id = auth.uid()))))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_codes coaches manage invite codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coaches manage invite codes" ON public.invite_codes USING ((((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'coach'::text)) WITH CHECK ((((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'coach'::text));


--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: routine_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.routine_days ENABLE ROW LEVEL SECURITY;

--
-- Name: routine_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: routines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

--
-- Name: set_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_set_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_set_logs ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict pdYw84uqTraHpcKkIuP7p2OeTtcbdX3ZIr2bwKVyaftmdL8xPkPA3mpbUx059Oc

