-- ============================================
-- Gr8Food Management System - UPDATED Setup
-- Run this if you already have Gr8FoodDB:
--   just run the UPDATE MENU ITEMS section
-- ============================================

-- If running fresh (no database yet):
CREATE DATABASE Gr8FoodDB;
GO
USE Gr8FoodDB;
GO

CREATE TABLE Users (
    UserID      INT           PRIMARY KEY IDENTITY(1,1),
    LoginID     VARCHAR(50)   NOT NULL UNIQUE,
    Password    VARCHAR(255)  NOT NULL,
    Role        VARCHAR(20)   NOT NULL CHECK (Role IN ('Admin','Manager','Chef','Customer')),
    FullName    VARCHAR(100)  NOT NULL,
    Email       VARCHAR(100)  NOT NULL,
    PhoneNumber VARCHAR(20),
    IsActive    BIT           NOT NULL DEFAULT 1,
    CreatedDate DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE Customers (
    CustomerID    INT            PRIMARY KEY,
    WalletBalance DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    Address       VARCHAR(255),
    FOREIGN KEY (CustomerID) REFERENCES Users(UserID)
);
GO

CREATE TABLE MenuItems (
    MenuItemID  INT            PRIMARY KEY IDENTITY(1,1),
    ItemName    VARCHAR(100)   NOT NULL,
    Description VARCHAR(500),
    Price       DECIMAL(10,2)  NOT NULL CHECK (Price >= 0),
    Category    VARCHAR(50)    NOT NULL,
    Status      VARCHAR(20)    NOT NULL DEFAULT 'Available'
                               CHECK (Status IN ('Available','Not Available')),
    ChefID      INT            NOT NULL,
    CreatedDate DATETIME       NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (ChefID) REFERENCES Users(UserID)
);
GO

CREATE TABLE Orders (
    OrderID     INT            PRIMARY KEY IDENTITY(1,1),
    CustomerID  INT            NOT NULL,
    OrderDate   DATETIME       NOT NULL DEFAULT GETDATE(),
    TotalAmount DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    Status      VARCHAR(20)    NOT NULL DEFAULT 'Pending'
                               CHECK (Status IN ('Pending','In Progress','Completed','Cancelled')),
    Notes       VARCHAR(500),
    FOREIGN KEY (CustomerID) REFERENCES Users(UserID)
);
GO

CREATE TABLE OrderItems (
    OrderItemID INT            PRIMARY KEY IDENTITY(1,1),
    OrderID     INT            NOT NULL,
    MenuItemID  INT            NOT NULL,
    Quantity    INT            NOT NULL CHECK (Quantity > 0),
    UnitPrice   DECIMAL(10,2)  NOT NULL,
    Subtotal    DECIMAL(10,2)  NOT NULL,
    FOREIGN KEY (OrderID)    REFERENCES Orders(OrderID),
    FOREIGN KEY (MenuItemID) REFERENCES MenuItems(MenuItemID)
);
GO

CREATE TABLE Feedback (
    FeedbackID      INT            PRIMARY KEY IDENTITY(1,1),
    CustomerID      INT            NOT NULL,
    OrderID         INT            NOT NULL UNIQUE,
    Message         VARCHAR(1000)  NOT NULL,
    Rating          INT            NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    FeedbackDate    DATETIME       NOT NULL DEFAULT GETDATE(),
    ManagerResponse VARCHAR(1000),
    ResponseDate    DATETIME,
    FOREIGN KEY (CustomerID) REFERENCES Users(UserID),
    FOREIGN KEY (OrderID)    REFERENCES Orders(OrderID)
);
GO

CREATE TABLE WalletTransactions (
    TransactionID   INT            PRIMARY KEY IDENTITY(1,1),
    CustomerID      INT            NOT NULL,
    TransactionType VARCHAR(20)    NOT NULL CHECK (TransactionType IN ('TopUp','Deduction','Refund')),
    Amount          DECIMAL(10,2)  NOT NULL CHECK (Amount > 0),
    Description     VARCHAR(255),
    TransactionDate DATETIME       NOT NULL DEFAULT GETDATE(),
    OrderID         INT,
    FOREIGN KEY (CustomerID) REFERENCES Users(UserID),
    FOREIGN KEY (OrderID)    REFERENCES Orders(OrderID)
);
GO

-- ============================================
-- TEST ACCOUNTS
-- ============================================
INSERT INTO Users (LoginID,Password,Role,FullName,Email,PhoneNumber) VALUES
('admin001',   'Admin@123', 'Admin',    'System Administrator', 'admin@gr8food.com',   '0123456789'),
('chef001',    'Chef@123',  'Chef',     'Chef Ahmad',           'ahmad@gr8food.com',   '0111234567'),
('manager001', 'Mgr@123',   'Manager',  'Manager Sara',         'sara@gr8food.com',    '0127654321'),
('cust001',    'Cust@123',  'Customer', 'Ali bin Abu',          'ali@email.com',       '0199876543'),
('cust002',    'Cust@123',  'Customer', 'Siti Aminah',          'siti@email.com',      '0188765432');
GO

INSERT INTO Customers (CustomerID, WalletBalance, Address) VALUES
(4, 50.00, '123 Jalan Maju, Kuala Lumpur'),
(5, 30.00, '456 Jalan Setia, Petaling Jaya');
GO

-- ============================================
-- MENU ITEMS — correct categories per brief:
-- Breakfast / Lunch / Dinner / Snacks / Drinks
-- ============================================
INSERT INTO MenuItems (ItemName, Description, Price, Category, Status, ChefID) VALUES
-- Breakfast
('Nasi Lemak',        'Coconut rice with sambal, egg and peanuts',  8.50,  'Breakfast', 'Available', 2),
('Roti Canai',        'Flaky flatbread served with curry dip',       3.00,  'Breakfast', 'Available', 2),
('Half Boiled Eggs',  'Two soft-boiled eggs with soy sauce',         4.00,  'Breakfast', 'Available', 2),

-- Lunch
('Nasi Campur',       'Rice with choice of lauk',                   10.00, 'Lunch',     'Available', 2),
('Mee Goreng',        'Fried yellow noodles with egg and veggies',   7.50,  'Lunch',     'Available', 2),
('Chicken Rice',      'Steamed chicken with fragrant rice',          9.00,  'Lunch',     'Available', 2),

-- Dinner
('Ayam Goreng',       'Crispy fried chicken with rice',             12.00, 'Dinner',    'Available', 2),
('Ikan Bakar',        'Grilled fish with sambal',                   14.00, 'Dinner',    'Available', 2),
('Nasi Goreng',       'Fried rice with egg and chicken',            10.00, 'Dinner',    'Available', 2),

-- Snacks
('Kuih Lapis',        'Layered rice cake, assorted flavours',         4.00, 'Snacks',    'Available', 2),
('Karipap',           'Crispy curry puffs',                           5.00, 'Snacks',    'Available', 2),

-- Drinks
('Teh Tarik',         'Pulled milk tea',                              3.00, 'Drinks',    'Available', 2),
('Milo Ais',          'Iced Milo drink',                              3.50, 'Drinks',    'Available', 2),
('Jus Oren',          'Fresh orange juice',                           5.00, 'Drinks',    'Available', 2),
('Air Mineral',       'Mineral water',                                1.50, 'Drinks',    'Available', 2);
GO

PRINT 'Gr8FoodDB setup complete! All categories: Breakfast/Lunch/Dinner/Snacks/Drinks';
