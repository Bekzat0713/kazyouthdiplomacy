namespace Gr8FoodSystem.Models
{
    public class OrderItem
    {
        public int OrderItemID { get; set; }
        public int OrderID { get; set; }
        public int MenuItemID { get; set; }
        public string ItemName { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Subtotal { get; set; }

        public OrderItem() { }

        public OrderItem(int menuItemID, string itemName, int quantity, decimal unitPrice)
        {
            MenuItemID = menuItemID;
            ItemName = itemName;
            Quantity = quantity;
            UnitPrice = unitPrice;
            Subtotal = quantity * unitPrice;
        }
    }
}
