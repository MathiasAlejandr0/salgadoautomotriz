-- Seed de demo (opcional)
insert into public.vehicles (slug, brand, model, year, version, category, fuel, transmission, mileage, color, doors, engine, price, description, published, featured)
values
  ('toyota-rav4-limited-2021', 'Toyota', 'RAV4', 2021, '2.5 Limited 4x4', 'SUV', 'Bencina', 'Automática', 45800, 'Gris Oscuro', 4, '2.5L', 18990000, 'RAV4 Limited 4x4 en excelente estado.', true, true),
  ('toyota-hilux-srx-2022', 'Toyota', 'Hilux', 2022, 'SRX 4x4', 'Camioneta', 'Diésel', 'Automática', 32000, 'Negro', 4, '2.8L', 24990000, 'Hilux SRX impecable.', true, true),
  ('ford-ranger-xlt-2021', 'Ford', 'Ranger', 2021, 'XLT 3.2 4x4', 'Camioneta', 'Diésel', 'Automática', 51000, 'Plata', 4, '3.2L', 21990000, 'Ranger XLT lista.', true, true)
on conflict (slug) do nothing;

insert into public.reviews (nombre, ciudad, rating, texto, published)
values
  ('Carlos M.', 'Puerto Montt', 5, 'Excelente atención. Me ayudaron con el financiamiento.', true),
  ('María P.', 'Osorno', 5, 'El auto estaba impecable. Todo transparente.', true);
