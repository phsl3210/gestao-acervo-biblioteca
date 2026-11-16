-- =====================================================================
-- BiblioGestão - estrutura do banco (cole tudo no SQL Editor do Supabase)
-- =====================================================================

-- ---------- PERFIS (quem é bibliotecário e quem é aluno) ----------
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel text not null default 'aluno' check (papel in ('bibliotecario', 'aluno')),
  criado_em timestamptz not null default now()
);

-- ---------- LIVROS ----------
create table if not exists livros (
  id bigint generated always as identity primary key,
  titulo text not null,
  autor text not null,
  isbn text not null unique,
  quantidade int not null check (quantidade >= 1),
  capa text,
  criado_em timestamptz not null default now()
);

-- ---------- LEITORES (alunos que pegam livro) ----------
create table if not exists leitores (
  id bigint generated always as identity primary key,
  nome text not null,
  turma text not null,
  matricula text unique,          -- opcional (vazio = null)
  email text not null,
  criado_em timestamptz not null default now()
);

-- ---------- EMPRÉSTIMOS ----------
create table if not exists emprestimos (
  id bigint generated always as identity primary key,
  livro_id bigint not null references livros(id) on delete cascade,
  leitor_id bigint not null references leitores(id) on delete cascade,
  data_saida date not null default current_date,
  data_prevista date not null,
  data_devolucao date,            -- null = ainda emprestado
  aviso_atraso_em date,           -- último dia em que avisamos o atraso
  criado_em timestamptz not null default now()
);

create index if not exists idx_emprestimos_livro on emprestimos(livro_id);
create index if not exists idx_emprestimos_leitor on emprestimos(leitor_id);

-- =====================================================================
-- REGRAS NO BANCO (valem mesmo se duas pessoas usarem ao mesmo tempo)
-- =====================================================================

-- Novo empréstimo: tem exemplar? aluno abaixo do limite de 4? já não está com esse livro?
create or replace function validar_emprestimo() returns trigger
language plpgsql as $$
declare
  qtd int;
  fora int;
  do_aluno int;
begin
  select quantidade into qtd from livros where id = new.livro_id for update;
  select count(*) into fora from emprestimos
    where livro_id = new.livro_id and data_devolucao is null;
  if fora >= qtd then
    raise exception 'Não há exemplares disponíveis desse livro.';
  end if;

  select count(*) into do_aluno from emprestimos
    where leitor_id = new.leitor_id and data_devolucao is null;
  if do_aluno >= 4 then
    raise exception 'Esse aluno já está com 4 livros emprestados (o limite). Registre uma devolução antes.';
  end if;

  if exists (select 1 from emprestimos
             where livro_id = new.livro_id and leitor_id = new.leitor_id and data_devolucao is null) then
    raise exception 'Esse aluno já está com um exemplar desse livro.';
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_emprestimo on emprestimos;
create trigger trg_validar_emprestimo before insert on emprestimos
  for each row execute function validar_emprestimo();

-- Não deixa baixar a quantidade abaixo do que está emprestado
create or replace function validar_quantidade() returns trigger
language plpgsql as $$
declare fora int;
begin
  select count(*) into fora from emprestimos
    where livro_id = new.id and data_devolucao is null;
  if new.quantidade < fora then
    raise exception 'Há % exemplar(es) emprestado(s). A quantidade não pode ser menor que isso.', fora;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_quantidade on livros;
create trigger trg_validar_quantidade before update of quantidade on livros
  for each row execute function validar_quantidade();

-- Não deixa apagar livro com exemplar emprestado
create or replace function bloquear_remocao_livro() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from emprestimos where livro_id = old.id and data_devolucao is null) then
    raise exception 'Esse livro tem exemplares emprestados. Registre a devolução antes de remover.';
  end if;
  return old;
end $$;

drop trigger if exists trg_bloquear_remocao_livro on livros;
create trigger trg_bloquear_remocao_livro before delete on livros
  for each row execute function bloquear_remocao_livro();

-- Não deixa apagar aluno que está com livro
create or replace function bloquear_remocao_leitor() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from emprestimos where leitor_id = old.id and data_devolucao is null) then
    raise exception 'Esse aluno está com livro emprestado. Registre a devolução antes de remover.';
  end if;
  return old;
end $$;

drop trigger if exists trg_bloquear_remocao_leitor on leitores;
create trigger trg_bloquear_remocao_leitor before delete on leitores
  for each row execute function bloquear_remocao_leitor();

-- =====================================================================
-- SEGURANÇA (RLS): só bibliotecário mexe nos dados
-- =====================================================================

create or replace function eh_bibliotecario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'bibliotecario');
$$;

alter table perfis enable row level security;
alter table livros enable row level security;
alter table leitores enable row level security;
alter table emprestimos enable row level security;

drop policy if exists "ver proprio perfil" on perfis;
create policy "ver proprio perfil" on perfis
  for select to authenticated using (id = auth.uid());

drop policy if exists "bibliotecario total" on livros;
create policy "bibliotecario total" on livros
  for all to authenticated using (eh_bibliotecario()) with check (eh_bibliotecario());

drop policy if exists "bibliotecario total" on leitores;
create policy "bibliotecario total" on leitores
  for all to authenticated using (eh_bibliotecario()) with check (eh_bibliotecario());

drop policy if exists "bibliotecario total" on emprestimos;
create policy "bibliotecario total" on emprestimos
  for all to authenticated using (eh_bibliotecario()) with check (eh_bibliotecario());

-- =====================================================================
-- DEPOIS de criar seu usuário em Authentication > Users, rode isto
-- (troque o e-mail e o nome) para te tornar bibliotecário:
--
-- insert into perfis (id, nome, papel)
-- select id, 'Seu Nome', 'bibliotecario' from auth.users
-- where email = 'SEU_EMAIL_AQUI'
-- on conflict (id) do update set papel = 'bibliotecario', nome = excluded.nome;
-- =====================================================================
