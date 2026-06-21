using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;

namespace Gr8FoodSystem
{
    public class FeedbackSubmitForm : Form
    {
        private ComboBox cmbOrder;
        private TextBox txtMessage;
        private ComboBox cmbRating;
        private Button btnSubmit;
        private Label lblStatus;
        private DataTable completedOrders;

        public FeedbackSubmitForm()
        {
            InitializeComponent();
            LoadCompletedOrders();
        }

        private void InitializeComponent()
        {
            this.Text = "Send Feedback";
            this.Size = new Size(600, 440);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(160, 50, 0), Dock = DockStyle.Top, Height = 45 };
            pnlTop.Controls.Add(new Label
            {
                Text = "Send Feedback",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            Label lblNote = new Label
            {
                Text = "You can only send feedback for Completed orders.",
                Font = new Font("Segoe UI", 9, FontStyle.Italic),
                Location = new Point(20, 56), Size = new Size(540, 20),
                ForeColor = Color.Gray
            };

            Label lblOrder = new Label
            {
                Text = "Select Order:",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(20, 88), Size = new Size(120, 24)
            };

            cmbOrder = new ComboBox
            {
                Location = new Point(150, 86), Size = new Size(400, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };

            Label lblRating = new Label
            {
                Text = "Rating (1-5):",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(20, 126), Size = new Size(120, 24)
            };

            cmbRating = new ComboBox
            {
                Location = new Point(150, 124), Size = new Size(100, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };
            cmbRating.Items.AddRange(new string[] { "5 - Excellent", "4 - Good", "3 - Average", "2 - Poor", "1 - Terrible" });
            cmbRating.SelectedIndex = 0;

            Label lblMsg = new Label
            {
                Text = "Your Feedback:",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(20, 166), Size = new Size(120, 24)
            };

            txtMessage = new TextBox
            {
                Location = new Point(20, 192), Size = new Size(540, 130),
                Multiline = true, Font = new Font("Segoe UI", 10),
                ScrollBars = ScrollBars.Vertical,
                MaxLength = 1000
            };

            btnSubmit = new Button
            {
                Text = "Submit Feedback",
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                Location = new Point(20, 336), Size = new Size(540, 44),
                BackColor = Color.FromArgb(0, 140, 60), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnSubmit.FlatAppearance.BorderSize = 0;
            btnSubmit.Click += BtnSubmit_Click;

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(20, 388), Size = new Size(540, 22),
                ForeColor = Color.DarkGreen, TextAlign = ContentAlignment.MiddleCenter
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop, lblNote, lblOrder, cmbOrder,
                lblRating, cmbRating, lblMsg, txtMessage,
                btnSubmit, lblStatus
            });
        }

        private void LoadCompletedOrders()
        {
            // Only show completed orders that don't already have feedback
            string q = @"SELECT o.OrderID,
                                CONVERT(varchar,o.OrderDate,103) AS OrderDate,
                                o.TotalAmount
                         FROM Orders o
                         WHERE o.CustomerID = @CID
                           AND o.Status = 'Completed'
                           AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.OrderID = o.OrderID)
                         ORDER BY o.OrderDate DESC";
            completedOrders = DBHelper.ExecuteQuery(q,
                new SqlParameter[] { new SqlParameter("@CID", LoginForm.CurrentUser.UserID) });

            cmbOrder.Items.Add("-- Select a completed order --");
            foreach (DataRow r in completedOrders.Rows)
                cmbOrder.Items.Add($"Order #{r["OrderID"]}  —  {r["OrderDate"]}  —  RM {Convert.ToDecimal(r["TotalAmount"]):F2}");
            cmbOrder.SelectedIndex = 0;
        }

        private void BtnSubmit_Click(object sender, EventArgs e)
        {
            if (cmbOrder.SelectedIndex == 0)
            { SetStatus("Please select an order.", Color.Red); return; }

            if (string.IsNullOrWhiteSpace(txtMessage.Text))
            { SetStatus("Please write your feedback message.", Color.Red); return; }

            if (txtMessage.Text.Trim().Length < 10)
            { SetStatus("Feedback must be at least 10 characters.", Color.Red); return; }

            DataRow selected = completedOrders.Rows[cmbOrder.SelectedIndex - 1];
            int orderID = Convert.ToInt32(selected["OrderID"]);
            int rating  = 5 - cmbRating.SelectedIndex; // 5,4,3,2,1

            string q = @"INSERT INTO Feedback (CustomerID, OrderID, Message, Rating)
                         VALUES (@CID, @OID, @Msg, @R)";
            SqlParameter[] p =
            {
                new SqlParameter("@CID", LoginForm.CurrentUser.UserID),
                new SqlParameter("@OID", orderID),
                new SqlParameter("@Msg", txtMessage.Text.Trim()),
                new SqlParameter("@R",   rating)
            };
            DBHelper.ExecuteNonQuery(q, p);

            SetStatus("Feedback submitted successfully! Thank you.", Color.DarkGreen);
            txtMessage.Clear();
            cmbOrder.Items.RemoveAt(cmbOrder.SelectedIndex);
            cmbOrder.SelectedIndex = 0;
        }

        private void SetStatus(string msg, Color c)
        {
            lblStatus.Text = msg; lblStatus.ForeColor = c;
        }
    }
}
