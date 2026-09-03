-- 0038: вайбкодинг-мастерская — таблицы проектов и лога событий агента
CREATE TABLE IF NOT EXISTS magnum_workshop_projects (
	id serial PRIMARY KEY,
	user_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE,
	prompt text NOT NULL,
	title text,
	sandbox_id text,
	preview_url text,
	status text NOT NULL DEFAULT 'pending',
	error_message text,
	is_public boolean NOT NULL DEFAULT true,
	likes integer NOT NULL DEFAULT 0,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS magnum_workshop_events (
	id serial PRIMARY KEY,
	project_id integer NOT NULL REFERENCES magnum_workshop_projects(id) ON DELETE CASCADE,
	type text NOT NULL,
	text text NOT NULL,
	meta jsonb DEFAULT '{}'::jsonb,
	created_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS magnum_workshop_projects_user_idx ON magnum_workshop_projects(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS magnum_workshop_projects_public_idx ON magnum_workshop_projects(is_public, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS magnum_workshop_events_project_idx ON magnum_workshop_events(project_id, created_at);
