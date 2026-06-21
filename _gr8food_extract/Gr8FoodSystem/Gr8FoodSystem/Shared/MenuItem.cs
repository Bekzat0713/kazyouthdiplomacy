using System;

namespace Gr8FoodSystem.Models
{
    public class MenuItem
    {
        public int MenuItemID { get; set; }
        public string ItemName { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public string Category { get; set; }
        public string Status { get; set; }
        public int ChefID { get; set; }
        public string ChefName { get; set; }
        public DateTime CreatedDate { get; set; }

        public bool IsAvailable => Status == "Available";

        public MenuItem() { }

        public MenuItem(string itemName, string description, decimal price,
                        string category, int chefID)
        {
            ItemName = itemName;
            Description = description;
            Price = price;
            Category = category;
            Status = "Available";
            ChefID = chefID;
            CreatedDate = DateTime.Now;
        }

        public override string ToString()
        {
            return $"{ItemName} — RM {Price:F2} [{Status}]";
        }
    }
}
