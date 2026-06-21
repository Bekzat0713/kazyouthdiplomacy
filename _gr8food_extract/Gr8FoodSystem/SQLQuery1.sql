USE Gr8FoodDB;
GO
DELETE FROM OrderItems;
DELETE FROM Orders;
DELETE FROM Feedback;
DELETE FROM WalletTransactions;
DELETE FROM MenuItems;
GO
INSERT INTO MenuItems (ItemName,Description,Price,Category,Status,ChefID) VALUES
('Nasi Lemak',       'Coconut rice with sambal',           8.50,  'Breakfast','Available',2),
('Roti Canai',       'Flatbread with curry dip',           3.00,  'Breakfast','Available',2),
('Half Boiled Eggs', 'Soft-boiled eggs with soy sauce',    4.00,  'Breakfast','Available',2),
('Nasi Campur',      'Rice with choice of lauk',          10.00,  'Lunch',    'Available',2),
('Mee Goreng',       'Fried noodles with egg',             7.50,  'Lunch',    'Available',2),
('Chicken Rice',     'Steamed chicken with rice',          9.00,  'Lunch',    'Available',2),
('Ayam Goreng',      'Crispy fried chicken',              12.00,  'Dinner',   'Available',2),
('Ikan Bakar',       'Grilled fish with sambal',          14.00,  'Dinner',   'Available',2),
('Nasi Goreng',      'Fried rice with chicken',           10.00,  'Dinner',   'Available',2),
('Kuih Lapis',       'Layered rice cake',                  4.00,  'Snacks',   'Available',2),
('Karipap',          'Crispy curry puffs',                 5.00,  'Snacks',   'Available',2),
('Teh Tarik',        'Pulled milk tea',                    3.00,  'Drinks',   'Available',2),
('Milo Ais',         'Iced Milo drink',                    3.50,  'Drinks',   'Available',2),
('Jus Oren',         'Fresh orange juice',                 5.00,  'Drinks',   'Available',2),
('Air Mineral',      'Mineral water',                      1.50,  'Drinks',   'Available',2);
GO
UPDATE Customers SET WalletBalance = 50.00 WHERE CustomerID = 4;
GO
PRINT 'Done!';