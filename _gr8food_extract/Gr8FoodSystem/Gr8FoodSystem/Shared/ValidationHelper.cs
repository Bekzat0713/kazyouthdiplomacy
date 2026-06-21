using System;
using System.Text.RegularExpressions;

namespace Gr8FoodSystem.Helpers
{
    // Reusable validation methods used by all forms
    public static class ValidationHelper
    {
        public static bool IsEmpty(string value)
        {
            return string.IsNullOrWhiteSpace(value);
        }

        public static bool IsValidEmail(string email)
        {
            if (IsEmpty(email)) return false;
            return Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
        }

        public static bool IsValidPhone(string phone)
        {
            if (IsEmpty(phone)) return false;
            return Regex.IsMatch(phone, @"^[0-9]{10,11}$");
        }

        public static bool IsValidPrice(string price, out decimal result)
        {
            result = 0;
            if (IsEmpty(price)) return false;
            return decimal.TryParse(price, out result) && result >= 0;
        }

        public static bool IsValidQuantity(string qty, out int result)
        {
            result = 0;
            if (IsEmpty(qty)) return false;
            return int.TryParse(qty, out result) && result > 0;
        }

        public static bool IsValidPassword(string password)
        {
            // Min 6 characters
            return !IsEmpty(password) && password.Length >= 6;
        }

        public static bool IsValidLoginID(string loginID)
        {
            if (IsEmpty(loginID)) return false;
            return Regex.IsMatch(loginID, @"^[a-zA-Z0-9_]{4,20}$");
        }
    }
}
