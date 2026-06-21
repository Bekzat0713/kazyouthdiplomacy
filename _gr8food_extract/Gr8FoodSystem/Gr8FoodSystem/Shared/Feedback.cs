using System;

namespace Gr8FoodSystem.Models
{
    public class Feedback
    {
        public int FeedbackID { get; set; }
        public int CustomerID { get; set; }
        public string CustomerName { get; set; }
        public int OrderID { get; set; }
        public string Message { get; set; }
        public int Rating { get; set; }
        public DateTime FeedbackDate { get; set; }
        public string ManagerResponse { get; set; }
        public DateTime? ResponseDate { get; set; }

        public bool HasResponse => !string.IsNullOrEmpty(ManagerResponse);

        public Feedback()
        {
            FeedbackDate = DateTime.Now;
        }

        public string GetRatingStars()
        {
            return new string('*', Rating) + new string('-', 5 - Rating);
        }
    }
}
