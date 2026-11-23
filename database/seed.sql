-- Sample medicines. Medicine 9 is expired and medicine 10 has no stock, so the
-- sale rule can be tried straight away.
insert into medicines (name, price, stock, expiry_date) values
  ('Paracetamol 500mg',   300, 200, current_date + 400),
  ('Amoxicillin 500mg',   800,  80, current_date + 250),
  ('Ibuprofen 400mg',     500, 120, current_date + 300),
  ('ORS sachets',         200, 150, current_date + 500),
  ('Cetirizine 10mg',     450,  60, current_date + 180),
  ('Metronidazole 400mg', 600,  40, current_date + 220),
  ('Vitamin C 1000mg',    700,  90, current_date + 600),
  ('Cough syrup',        1500,  25, current_date + 90),
  ('Old antacid',         400,  30, current_date - 20),
  ('Zinc tablets',        350,   0, current_date + 300);

-- After creating a pharmacist and a manager under Authentication > Users,
-- copy each user's UID and run (replace the placeholders):
--
-- insert into profiles (id, role) values
--   ('PHARMACIST-UID-HERE', 'pharmacist'),
--   ('MANAGER-UID-HERE', 'manager');