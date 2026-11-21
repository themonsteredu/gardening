create schema gardening_private;
revoke all on schema gardening_private from public, anon, authenticated;

create table gardening_private.service_keys (
  name text primary key,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$')
);
create table gardening_private.classes (
  code text primary key check (code ~ '^[A-Z0-9]{6,10}$'),
  teacher_hash text not null check (teacher_hash ~ '^[0-9a-f]{64}$'),
  project jsonb not null check (jsonb_typeof(project) = 'object' and project->>'classCode' = code),
  created_at timestamptz not null default now()
);
create table gardening_private.works (
  class_code text not null references gardening_private.classes(code),
  session_id text not null,
  edit_hash text not null check (edit_hash ~ '^[0-9a-f]{64}$'),
  entry jsonb not null check (jsonb_typeof(entry) = 'object' and entry->>'studentSessionId' = session_id),
  updated_at timestamptz not null default now(),
  primary key (class_code, session_id)
);

alter table gardening_private.service_keys enable row level security;
alter table gardening_private.classes enable row level security;
alter table gardening_private.works enable row level security;
revoke all on all tables in schema gardening_private from public, anon, authenticated;

-- The Next server alone holds this app's token. Clients have no direct table grants.
create function public.gardening_class_command(p_token text, p_operation text, p_code text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  stored_project jsonb;
  stored_teacher_hash text;
  stored_entries jsonb;
  submitted_entry jsonb;
  affected int;
begin
  if p_token is null or length(p_token) <> 64 or not exists (
    select 1 from gardening_private.service_keys where name = 'gardening_web'
      and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise insufficient_privilege using message = 'Access denied';
  end if;
  if p_code is null or p_code !~ '^[A-Z0-9]{6,10}$' or octet_length(p_payload::text) > 2000000 then
    return jsonb_build_object('status',400);
  end if;
  if p_operation = 'create' then
    insert into gardening_private.classes(code, teacher_hash, project)
      values(p_code,p_payload->>'teacherHash',p_payload->'project')
      on conflict (code) do nothing;
    get diagnostics affected = row_count;
    select project, teacher_hash into stored_project, stored_teacher_hash
      from gardening_private.classes where code = p_code;
    if stored_teacher_hash is distinct from p_payload->>'teacherHash' then
      return jsonb_build_object('status',409);
    end if;
    return jsonb_build_object('status',case when affected = 1 then 201 else 200 end,'project',stored_project);
  end if;

  select project into stored_project from gardening_private.classes where code = p_code;
  if not found then return jsonb_build_object('status',404); end if;
  if p_operation = 'get' then return jsonb_build_object('status',200,'project',stored_project); end if;
  if p_operation = 'list' then
    select coalesce(jsonb_agg(entry order by updated_at desc, session_id), '[]'::jsonb) into stored_entries
      from gardening_private.works where class_code=p_code;
    return jsonb_build_object('status',200,'entries',stored_entries);
  end if;
  if p_operation = 'submit' then
    submitted_entry := p_payload->'entry';
    if submitted_entry->>'schoolProjectId' is distinct from stored_project->>'id' then
      return jsonb_build_object('status',400);
    end if;
    insert into gardening_private.works as w(class_code, session_id, edit_hash, entry)
      values(p_code, submitted_entry->>'studentSessionId', p_payload->>'editHash', submitted_entry)
      on conflict (class_code, session_id) do update set entry=excluded.entry, updated_at=now()
      where w.edit_hash = excluded.edit_hash;
    get diagnostics affected = row_count;
    return jsonb_build_object('status',case when affected = 1 then 200 else 403 end);
  end if;
  return jsonb_build_object('status',400);
end;
$$;
revoke all on function public.gardening_class_command(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.gardening_class_command(text,text,text,jsonb) to anon;
