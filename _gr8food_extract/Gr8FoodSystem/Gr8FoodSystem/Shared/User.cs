using System;

namespace Gr8FoodSystem.Models
{
    // One simple class for every user in the system.
    // The "Role" field tells us if the user is an Admin, Manager, Chef or Customer.
    public class User
    {
        // ----- Properties (the information each user has) -----
        public int UserID { get; set; }
        public string LoginID { get; set; }
        public string Password { get; set; }
        public string Role { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string PhoneNumber { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedDate { get; set; }

        // These two are only used when the user is a Customer
        public decimal WalletBalance { get; set; }
        public string Address { get; set; }

        // ----- Constructors (overloaded: two versions) -----

        // Empty constructor
        public User()
        {
            IsActive = true;
            CreatedDate = DateTime.Now;
        }

        // Constructor with the main details
        public User(int userID, string loginID, string role, string fullName,
                    string email, string phoneNumber)
        {
            UserID = userID;
            LoginID = loginID;
            Role = role;
            FullName = fullName;
            Email = email;
            PhoneNumber = phoneNumber;
            IsActive = true;
            CreatedDate = DateTime.Now;
        }

        // ----- Wallet methods (used by Customer) -----

        // Returns true if the customer has enough money in the wallet
        public bool CanAfford(decimal amount)
        {
            return WalletBalance >= amount;
        }

        // Takes money out of the wallet (when an order is paid)
        public void Deduct(decimal amount)
        {
            WalletBalance = WalletBalance - amount;
        }

        // Adds money to the wallet (top up or refund)
        public void Refund(decimal amount)
        {
            WalletBalance = WalletBalance + amount;
        }
    }
}
