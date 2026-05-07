-- BistekaBet — seed das 48 seleções da Copa do Mundo 2026
-- Dados oficiais conforme sorteio FIFA de 5 dez 2025 (Kennedy Center, Washington D.C.).
-- Aplicar manualmente no Supabase Studio. Idempotente — pode ser re-executado sem duplicar.
-- Códigos seguem padrão FIFA (3 letras maiúsculas).

insert into public.teams (code, name, group_code) values
  -- Grupo A
  ('MEX', 'México',                 'A'),
  ('RSA', 'África do Sul',          'A'),
  ('KOR', 'Coreia do Sul',          'A'),
  ('CZE', 'República Tcheca',       'A'),
  -- Grupo B
  ('CAN', 'Canadá',                 'B'),
  ('BIH', 'Bósnia e Herzegovina',   'B'),
  ('QAT', 'Catar',                  'B'),
  ('SUI', 'Suíça',                  'B'),
  -- Grupo C
  ('BRA', 'Brasil',                 'C'),
  ('MAR', 'Marrocos',               'C'),
  ('HAI', 'Haiti',                  'C'),
  ('SCO', 'Escócia',                'C'),
  -- Grupo D
  ('USA', 'Estados Unidos',         'D'),
  ('PAR', 'Paraguai',               'D'),
  ('AUS', 'Austrália',              'D'),
  ('TUR', 'Turquia',                'D'),
  -- Grupo E
  ('GER', 'Alemanha',               'E'),
  ('CUW', 'Curaçao',                'E'),
  ('CIV', 'Costa do Marfim',        'E'),
  ('ECU', 'Equador',                'E'),
  -- Grupo F
  ('NED', 'Países Baixos',          'F'),
  ('JPN', 'Japão',                  'F'),
  ('SWE', 'Suécia',                 'F'),
  ('TUN', 'Tunísia',                'F'),
  -- Grupo G
  ('BEL', 'Bélgica',                'G'),
  ('EGY', 'Egito',                  'G'),
  ('IRN', 'Irã',                    'G'),
  ('NZL', 'Nova Zelândia',          'G'),
  -- Grupo H
  ('ESP', 'Espanha',                'H'),
  ('CPV', 'Cabo Verde',             'H'),
  ('KSA', 'Arábia Saudita',         'H'),
  ('URU', 'Uruguai',                'H'),
  -- Grupo I
  ('FRA', 'França',                 'I'),
  ('SEN', 'Senegal',                'I'),
  ('IRQ', 'Iraque',                 'I'),
  ('NOR', 'Noruega',                'I'),
  -- Grupo J
  ('ARG', 'Argentina',              'J'),
  ('ALG', 'Argélia',                'J'),
  ('AUT', 'Áustria',                'J'),
  ('JOR', 'Jordânia',               'J'),
  -- Grupo K
  ('POR', 'Portugal',               'K'),
  ('COD', 'República Democrática do Congo', 'K'),
  ('UZB', 'Uzbequistão',            'K'),
  ('COL', 'Colômbia',               'K'),
  -- Grupo L
  ('ENG', 'Inglaterra',             'L'),
  ('CRO', 'Croácia',                'L'),
  ('GHA', 'Gana',                   'L'),
  ('PAN', 'Panamá',                 'L')
on conflict (code) do nothing;
