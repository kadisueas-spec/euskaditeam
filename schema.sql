-- ============================================================
-- FitCoach - Schema completo de base de datos
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: profiles
-- Extiende la tabla auth.users de Supabase
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('coach', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: clients
-- Información específica de cada cliente del coach
-- ============================================================
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Info física para personalizar rutinas
  birth_date DATE,
  weight_kg DECIMAL(5,2),
  height_cm INTEGER,
  goal TEXT, -- ej: "hipertrofia", "fuerza", "pérdida de grasa"
  training_experience TEXT CHECK (training_experience IN ('beginner', 'intermediate', 'advanced')),
  notes_coach TEXT, -- notas privadas del coach sobre el cliente
  -- Estado
  is_active BOOLEAN DEFAULT TRUE,
  -- Suscripción
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'inactive' CHECK (
    subscription_status IN ('active', 'inactive', 'past_due', 'canceled', 'trialing')
  ),
  subscription_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: exercises
-- Biblioteca de ejercicios del coach
-- ============================================================
CREATE TABLE exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Video demostrativo
  video_url TEXT, -- URL de Cloudflare Stream
  video_thumbnail_url TEXT,
  -- Clasificación
  muscle_group TEXT, -- ej: "pecho", "espalda", "piernas", "hombros", "bíceps", "tríceps", "core"
  secondary_muscles TEXT[], -- músculos secundarios
  equipment TEXT, -- ej: "barra", "mancuerna", "máquina", "peso corporal"
  movement_pattern TEXT, -- ej: "empuje", "jalón", "sentadilla", "bisagra", "llevar"
  -- Tips técnicos
  technique_tips TEXT,
  common_mistakes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: routines
-- Rutina asignada a un cliente específico
-- ============================================================
CREATE TABLE routines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL, -- ej: "Rutina Hipertrofia - Semana 1-4"
  description TEXT, -- explicación general de la rutina
  objective TEXT, -- objetivo específico de este bloque
  duration_weeks INTEGER, -- duración estimada del bloque
  -- Estado
  is_active BOOLEAN DEFAULT TRUE, -- solo una activa por cliente
  starts_at DATE,
  ends_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: routine_days
-- Días de entrenamiento dentro de una rutina
-- ============================================================
CREATE TABLE routine_days (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL, -- 1, 2, 3... (orden del día)
  name TEXT NOT NULL, -- ej: "Día A - Empuje", "Día B - Jalón"
  description TEXT, -- notas del coach para ese día
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: routine_exercises
-- Ejercicios dentro de cada día de rutina
-- ============================================================
CREATE TABLE routine_exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  day_id UUID REFERENCES routine_days(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL, -- orden dentro del día
  -- Prescripción
  sets INTEGER NOT NULL,
  reps_min INTEGER, -- ej: 8 (rango mínimo)
  reps_max INTEGER, -- ej: 12 (rango máximo)
  rir_target INTEGER, -- RIR objetivo (0-4)
  rest_seconds INTEGER, -- descanso entre series en segundos
  weight_suggestion TEXT, -- ej: "60% de tu 1RM", "peso moderado"
  -- Notas del coach para este ejercicio específico
  coach_notes TEXT,
  -- Sustitución permitida
  is_optional BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: workout_logs
-- Registro de cada sesión de entrenamiento del cliente
-- ============================================================
CREATE TABLE workout_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  routine_day_id UUID REFERENCES routine_days(id) ON DELETE SET NULL,
  -- Cuándo entrenó
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  -- Sensaciones generales
  overall_feeling INTEGER CHECK (overall_feeling BETWEEN 1 AND 5), -- 1=muy mal, 5=excelente
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  client_notes TEXT, -- notas libres del cliente sobre la sesión
  -- Estado
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: set_logs
-- Registro de cada serie individual dentro de una sesión
-- ============================================================
CREATE TABLE set_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workout_log_id UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
  routine_exercise_id UUID REFERENCES routine_exercises(id) ON DELETE SET NULL,
  set_number INTEGER NOT NULL, -- número de serie (1, 2, 3...)
  -- Lo que el cliente hizo
  weight_kg DECIMAL(6,2), -- peso utilizado
  reps INTEGER, -- repeticiones completadas
  rir INTEGER CHECK (rir BETWEEN 0 AND 10), -- RIR percibido
  -- Tiempo bajo tensión (opcional)
  tempo TEXT, -- ej: "3-1-2-0"
  -- Notas del cliente sobre esa serie
  client_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: feedback
-- Correcciones, tips y feedback del coach al cliente
-- ============================================================
CREATE TABLE feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  -- A qué se refiere el feedback (puede ser general o específico)
  workout_log_id UUID REFERENCES workout_logs(id) ON DELETE SET NULL,
  routine_exercise_id UUID REFERENCES routine_exercises(id) ON DELETE SET NULL,
  -- Contenido
  type TEXT CHECK (type IN ('correction', 'tip', 'encouragement', 'general', 'weight_adjustment')),
  message TEXT NOT NULL,
  -- Visibilidad
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: subscriptions
-- Historial de suscripciones de Stripe
-- ============================================================
CREATE TABLE subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuario solo ve sus propios datos
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: cada uno ve el suyo
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Clients: el coach ve todos sus clientes; el cliente ve solo el suyo
CREATE POLICY "Coach can view their clients"
  ON clients FOR SELECT
  USING (
    coach_id = auth.uid()
    OR user_id = auth.uid()
  );

CREATE POLICY "Coach can manage their clients"
  ON clients FOR ALL
  USING (coach_id = auth.uid());

-- Exercises: el coach ve y gestiona las suyas; los clientes solo lectura
CREATE POLICY "Coach manages their exercises"
  ON exercises FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view exercises from their coach"
  ON exercises FOR SELECT
  USING (
    coach_id IN (
      SELECT coach_id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Routines: el coach gestiona; el cliente ve la suya
CREATE POLICY "Coach manages routines"
  ON routines FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Client views own routine"
  ON routines FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Workout logs: el cliente gestiona los suyos; el coach los puede ver
CREATE POLICY "Client manages own workout logs"
  ON workout_logs FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Coach views client workout logs"
  ON workout_logs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE coach_id = auth.uid()
    )
  );

-- Set logs: siguen la misma lógica que workout_logs
CREATE POLICY "Client manages own set logs"
  ON set_logs FOR ALL
  USING (
    workout_log_id IN (
      SELECT id FROM workout_logs WHERE client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Coach views set logs"
  ON set_logs FOR SELECT
  USING (
    workout_log_id IN (
      SELECT id FROM workout_logs WHERE client_id IN (
        SELECT id FROM clients WHERE coach_id = auth.uid()
      )
    )
  );

-- Feedback: el coach gestiona; el cliente lee el suyo
CREATE POLICY "Coach manages feedback"
  ON feedback FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Client views own feedback"
  ON feedback FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Client can mark feedback as read"
  ON feedback FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- ÍNDICES para mejorar performance de consultas frecuentes
-- ============================================================

CREATE INDEX idx_clients_coach_id ON clients(coach_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_routines_client_id ON routines(client_id);
CREATE INDEX idx_routine_days_routine_id ON routine_days(routine_id);
CREATE INDEX idx_routine_exercises_day_id ON routine_exercises(day_id);
CREATE INDEX idx_workout_logs_client_id ON workout_logs(client_id);
CREATE INDEX idx_workout_logs_date ON workout_logs(workout_date DESC);
CREATE INDEX idx_set_logs_workout_log_id ON set_logs(workout_log_id);
CREATE INDEX idx_feedback_client_id ON feedback(client_id);
CREATE INDEX idx_feedback_unread ON feedback(client_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_exercises_coach_id ON exercises(coach_id);
