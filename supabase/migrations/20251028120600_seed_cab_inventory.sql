-- Seed basic cab inventory

BEGIN;

INSERT INTO cab_inventory (cab_type, make, model, model_year, base_price_per_km, per_day_charge, capacity, is_available, metadata)
VALUES
('hatchback','Maruti','Alto',2015,10.00, 1200.00, 3, true, '{"ac":true}'),
('hatchback','Tata','Tiago',2019,11.00, 1400.00, 3, true, '{"ac":true}'),
('sedan','Maruti','Dzire',2021,12.50, 1700.00, 4, true, '{"ac":true}'),
('sedan','Hyundai','Verna',2018,12.00, 1600.00, 4, true, '{"ac":true}'),
('sedan','Honda','City',2023,14.00, 2000.00, 4, true, '{"ac":true}'),
('suv','Mahindra','Scorpio',2017,16.00, 2500.00, 6, true, '{"ac":true}'),
('suv','Toyota','Innova',2022,18.00, 3000.00, 6, true, '{"ac":true}'),
('tempo','Force','Traveller',2016,20.00, 4500.00, 12, true, '{"ac":true}');

COMMIT;


