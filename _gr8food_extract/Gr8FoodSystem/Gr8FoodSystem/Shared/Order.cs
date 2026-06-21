using System;
using System.Collections.Generic;

namespace Gr8FoodSystem.Models
{
    public class Order
    {
        public int OrderID { get; set; }
        public int CustomerID { get; set; }
        public string CustomerName { get; set; }
        public DateTime OrderDate { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; }
        public string Notes { get; set; }
        public List<OrderItem> Items { get; set; }

        public Order()
        {
            Items = new List<OrderItem>();
            OrderDate = DateTime.Now;
            Status = "Pending";
        }

        public bool CanBeCancelled()
        {
            return Status == "Pending" || Status == "In Progress";
        }

        public bool CanLeaveFeedback()
        {
            return Status == "Completed";
        }
    }
}
