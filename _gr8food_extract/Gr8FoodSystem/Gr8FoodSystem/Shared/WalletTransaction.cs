using System;

namespace Gr8FoodSystem.Models
{
    public class WalletTransaction
    {
        public int TransactionID { get; set; }
        public int CustomerID { get; set; }
        public string CustomerName { get; set; }
        public string TransactionType { get; set; }
        public decimal Amount { get; set; }
        public string Description { get; set; }
        public DateTime TransactionDate { get; set; }
        public int? OrderID { get; set; }

        public WalletTransaction()
        {
            TransactionDate = DateTime.Now;
        }

        public WalletTransaction(int customerID, string type, decimal amount,
                                  string description, int? orderID = null)
        {
            CustomerID = customerID;
            TransactionType = type;
            Amount = amount;
            Description = description;
            OrderID = orderID;
            TransactionDate = DateTime.Now;
        }
    }
}
