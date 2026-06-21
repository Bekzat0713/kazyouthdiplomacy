using System;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Models;

namespace Gr8FoodSystem
{
    public class WalletTopUpForm : Form
    {
        private TextBox txtAmount;
        private Label   lblCurrentBalance, lblStatus;
        private Button  btnTopUp;

        public WalletTopUpForm() { InitializeComponent(); LoadBalance(); }

        private void InitializeComponent()
        {
            ThemeHelper.ApplyForm(this);
            this.Text = "Top Up E-Wallet";
            this.Size = new Size(420, 370);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;

            this.Controls.Add(ThemeHelper.MakeHeader("E-Wallet Top Up", "Add credit to your wallet"));

            lblCurrentBalance = new Label
            {
                Text      = "Current Balance: RM 0.00",
                Font      = ThemeHelper.FontHead,
                ForeColor = ThemeHelper.Primary,
                Location  = new Point(40, 100),
                Size      = new Size(320, 28),
                TextAlign = ContentAlignment.MiddleCenter
            };

            var lblAmt = new Label
            {
                Text      = "Enter Amount to Top Up (RM):",
                Font      = ThemeHelper.FontLabel,
                ForeColor = ThemeHelper.TextDark,
                Location  = new Point(40, 148),
                Size      = new Size(320, 22)
            };

            txtAmount = new TextBox
            {
                Font      = new Font("Segoe UI", 14),
                Location  = new Point(40, 172),
                Size      = new Size(320, 34),
                TextAlign = HorizontalAlignment.Center
            };

            // Quick top-up buttons
            Button b10  = ThemeHelper.MakeButton("RM 10",  40,  220, 72, 30);
            Button b20  = ThemeHelper.MakeButton("RM 20",  122, 220, 72, 30);
            Button b50  = ThemeHelper.MakeButton("RM 50",  204, 220, 72, 30);
            Button b100 = ThemeHelper.MakeButton("RM 100", 286, 220, 74, 30);
            b10.Click  += (s, e) => txtAmount.Text = "10";
            b20.Click  += (s, e) => txtAmount.Text = "20";
            b50.Click  += (s, e) => txtAmount.Text = "50";
            b100.Click += (s, e) => txtAmount.Text = "100";

            lblStatus = new Label
            {
                Text      = "",
                Font      = ThemeHelper.FontSmall,
                ForeColor = ThemeHelper.Danger,
                Location  = new Point(40, 262),
                Size      = new Size(320, 20),
                TextAlign = ContentAlignment.MiddleCenter
            };

            btnTopUp = ThemeHelper.MakeButton("TOP UP WALLET", 40, 290, 320, 46, ThemeHelper.Success);
            btnTopUp.Font   = ThemeHelper.FontHead;
            btnTopUp.Click += BtnTopUp_Click;

            this.Controls.AddRange(new Control[]
            { lblCurrentBalance, lblAmt, txtAmount, b10, b20, b50, b100, lblStatus, btnTopUp });
        }

        private void LoadBalance()
        {
            User c = LoginForm.CurrentUser;
            // Refresh from DB
            var row = DBHelper.ExecuteQuery(
                "SELECT WalletBalance FROM Customers WHERE CustomerID=@ID",
                new SqlParameter[] { new SqlParameter("@ID", c.UserID) });
            if (row.Rows.Count > 0)
            {
                c.WalletBalance = Convert.ToDecimal(row.Rows[0]["WalletBalance"]);
            }
            lblCurrentBalance.Text = $"Current Balance: RM {c.WalletBalance:F2}";
        }

        private void BtnTopUp_Click(object sender, EventArgs e)
        {
            lblStatus.Text = "";

            if (string.IsNullOrWhiteSpace(txtAmount.Text))
            { lblStatus.Text = "Please enter an amount."; return; }

            if (!decimal.TryParse(txtAmount.Text.Trim(), out decimal amount) || amount <= 0)
            { lblStatus.Text = "Please enter a valid positive amount."; return; }

            if (amount > 500)
            { lblStatus.Text = "Maximum top up per transaction is RM 500."; return; }

            if (MessageBox.Show($"Top up RM {amount:F2} to your wallet?",
                "Confirm Top Up", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
                return;

            try
            {
                int custID = LoginForm.CurrentUser.UserID;

                DBHelper.ExecuteNonQuery(
                    "UPDATE Customers SET WalletBalance = WalletBalance + @Amt WHERE CustomerID=@ID",
                    new SqlParameter[] {
                        new SqlParameter("@Amt", amount),
                        new SqlParameter("@ID",  custID) });

                DBHelper.ExecuteNonQuery(
                    @"INSERT INTO WalletTransactions (CustomerID,TransactionType,Amount,Description)
                      VALUES (@ID,'TopUp',@Amt,'Wallet top up')",
                    new SqlParameter[] {
                        new SqlParameter("@ID",  custID),
                        new SqlParameter("@Amt", amount) });

                LoginForm.CurrentUser.Refund(amount);

                lblStatus.ForeColor = ThemeHelper.Success;
                lblStatus.Text      = $"RM {amount:F2} added successfully!";
                txtAmount.Clear();
                LoadBalance();

                MessageBox.Show(
                    $"Top up successful!\nNew Balance: RM {LoginForm.CurrentUser.WalletBalance:F2}",
                    "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
