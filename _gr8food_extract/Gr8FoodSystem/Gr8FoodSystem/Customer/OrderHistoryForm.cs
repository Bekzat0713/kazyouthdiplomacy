using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Models;

namespace Gr8FoodSystem
{
    public class OrderHistoryForm : Form
    {
        private DataGridView dgvOrders, dgvItems;
        private Button btnCancel;
        private Label lblInfo, lblStatus;
        private int selectedOrderID = -1;
        private string selectedStatus = "";

        public OrderHistoryForm()
        {
            InitializeComponent();
            LoadOrders();
        }

        private void InitializeComponent()
        {
            this.Text = "My Orders";
            this.Size = new Size(900, 580);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(160, 50, 0), Dock = DockStyle.Top, Height = 45 };
            pnlTop.Controls.Add(new Label
            {
                Text = "My Order History",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            dgvOrders = new DataGridView
            {
                Location = new Point(10, 55), Size = new Size(860, 220),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.White, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9),
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            ThemeHelper.StyleGrid(dgvOrders);
            dgvOrders.SelectionChanged += DgvOrders_SelectionChanged;

            Label lblI = new Label
            {
                Text = "Items in Selected Order:",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(10, 282), Size = new Size(300, 20)
            };

            dgvItems = new DataGridView
            {
                Location = new Point(10, 302), Size = new Size(860, 140),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.WhiteSmoke, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9)
            };
            ThemeHelper.StyleGrid(dgvItems);

            lblInfo = new Label
            {
                Text = "Select an order to see its items.",
                Font = new Font("Segoe UI", 9, FontStyle.Italic),
                Location = new Point(10, 452), Size = new Size(600, 22),
                ForeColor = Color.Gray
            };

            btnCancel = new Button
            {
                Text = "Cancel Order (Refund)",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(650, 448), Size = new Size(220, 36),
                BackColor = Color.FromArgb(180, 30, 30), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderSize = 0;
            btnCancel.Click += BtnCancel_Click;

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(10, 494), Size = new Size(860, 22),
                ForeColor = Color.DarkGreen, TextAlign = ContentAlignment.MiddleCenter
            };

            this.Controls.AddRange(new Control[]
            { pnlTop, dgvOrders, lblI, dgvItems, lblInfo, btnCancel, lblStatus });
        }

        private void LoadOrders()
        {
            string q = @"SELECT o.OrderID,
                                o.TotalAmount AS [Total (RM)],
                                o.Status,
                                CONVERT(varchar,o.OrderDate,120) AS [Order Date],
                                o.Notes
                         FROM Orders o
                         WHERE o.CustomerID = @CID
                         ORDER BY o.OrderDate DESC";
            dgvOrders.DataSource = DBHelper.ExecuteQuery(q,
                new SqlParameter[] { new SqlParameter("@CID", LoginForm.CurrentUser.UserID) });
            if (dgvOrders.Columns.Contains("OrderID"))
                dgvOrders.Columns["OrderID"].Visible = false;
        }

        private void DgvOrders_SelectionChanged(object sender, EventArgs e)
        {
            if (dgvOrders.SelectedRows.Count == 0) return;
            DataGridViewRow r = dgvOrders.SelectedRows[0];
            selectedOrderID = Convert.ToInt32(r.Cells["OrderID"].Value);
            selectedStatus  = r.Cells["Status"].Value.ToString();
            lblInfo.Text    = $"Order #{selectedOrderID} — Status: {selectedStatus}";
            lblInfo.ForeColor = Color.FromArgb(160, 50, 0);
            LoadItems(selectedOrderID);
        }

        private void LoadItems(int orderID)
        {
            string q = @"SELECT mi.ItemName AS Item, oi.Quantity,
                                oi.UnitPrice AS [Unit Price (RM)],
                                oi.Subtotal  AS [Subtotal (RM)]
                         FROM OrderItems oi
                         JOIN MenuItems mi ON oi.MenuItemID = mi.MenuItemID
                         WHERE oi.OrderID = @ID";
            dgvItems.DataSource = DBHelper.ExecuteQuery(q,
                new SqlParameter[] { new SqlParameter("@ID", orderID) });
        }

        private void BtnCancel_Click(object sender, EventArgs e)
        {
            if (selectedOrderID == -1)
            { SetStatus("Select an order first.", Color.Red); return; }

            if (selectedStatus != "Pending" && selectedStatus != "In Progress")
            {
                SetStatus($"Cannot cancel a '{selectedStatus}' order.", Color.Red);
                return;
            }

            // Get total to refund
            object totalObj = DBHelper.ExecuteScalar(
                "SELECT TotalAmount FROM Orders WHERE OrderID=@ID",
                new SqlParameter[] { new SqlParameter("@ID", selectedOrderID) });
            decimal refundAmt = Convert.ToDecimal(totalObj);

            if (MessageBox.Show(
                $"Cancel Order #{selectedOrderID}?\nRM {refundAmt:F2} will be refunded to your wallet.",
                "Cancel Order", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes)
                return;

            try
            {
                // Step 1: change the order status to Cancelled
                string updateStatus = "UPDATE Orders SET Status='Cancelled' WHERE OrderID=@ID";
                DBHelper.ExecuteNonQuery(updateStatus, new SqlParameter[]
                {
                    new SqlParameter("@ID", selectedOrderID)
                });

                // Step 2: put the money back into the customer's wallet
                string refundWallet = "UPDATE Customers SET WalletBalance = WalletBalance + @Amt WHERE CustomerID=@CID";
                DBHelper.ExecuteNonQuery(refundWallet, new SqlParameter[]
                {
                    new SqlParameter("@Amt", refundAmt),
                    new SqlParameter("@CID", LoginForm.CurrentUser.UserID)
                });

                // Step 3: save a record of this refund
                string insertTrans = @"INSERT INTO WalletTransactions (CustomerID,TransactionType,Amount,Description,OrderID)
                                       VALUES (@CID,'Refund',@Amt,@Desc,@OID)";
                DBHelper.ExecuteNonQuery(insertTrans, new SqlParameter[]
                {
                    new SqlParameter("@CID", LoginForm.CurrentUser.UserID),
                    new SqlParameter("@Amt", refundAmt),
                    new SqlParameter("@Desc", "Refund for cancelled Order #" + selectedOrderID),
                    new SqlParameter("@OID", selectedOrderID)
                });

                LoginForm.CurrentUser.Refund(refundAmt);
                SetStatus($"Order #{selectedOrderID} cancelled. RM {refundAmt:F2} refunded.", Color.DarkGreen);
                LoadOrders();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error cancelling order:\n" + ex.Message, "Error",
                                MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void SetStatus(string msg, Color c)
        {
            lblStatus.Text = msg; lblStatus.ForeColor = c;
        }
    }
}

