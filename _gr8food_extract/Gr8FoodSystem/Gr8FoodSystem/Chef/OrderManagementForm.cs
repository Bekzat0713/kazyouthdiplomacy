using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;

namespace Gr8FoodSystem
{
    public class OrderManagementForm : Form
    {
        private DataGridView dgvOrders, dgvItems;
        private Button btnInProgress, btnCompleted;
        private Label lblInfo, lblStatus;
        private int selectedOrderID = -1;
        private string selectedCurrentStatus = "";

        public OrderManagementForm()
        {
            InitializeComponent();
            LoadOrders();
        }

        private void InitializeComponent()
        {
            this.Text = "Order Management";
            this.Size = new Size(900, 580);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(0, 140, 60), Dock = DockStyle.Top, Height = 45 };
            pnlTop.Controls.Add(new Label
            {
                Text = "Order Management — View & Update Status",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            // Orders grid (top)
            Label lblO = new Label
            {
                Text = "All Orders:", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(10, 54), Size = new Size(200, 20)
            };

            dgvOrders = new DataGridView
            {
                Location = new Point(10, 74), Size = new Size(860, 220),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.White, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9),
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            ThemeHelper.StyleGrid(dgvOrders);
            dgvOrders.SelectionChanged += DgvOrders_SelectionChanged;

            // Order items grid (bottom)
            Label lblI = new Label
            {
                Text = "Items in Selected Order:", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(10, 302), Size = new Size(300, 20)
            };

            dgvItems = new DataGridView
            {
                Location = new Point(10, 322), Size = new Size(860, 140),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.WhiteSmoke, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9)
            };
            ThemeHelper.StyleGrid(dgvItems);

            lblInfo = new Label
            {
                Text = "Select an order to see details and update its status.",
                Font = new Font("Segoe UI", 9, FontStyle.Italic),
                Location = new Point(10, 472), Size = new Size(600, 22),
                ForeColor = Color.Gray
            };

            btnInProgress = new Button
            {
                Text = "Mark: In Progress",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(620, 468), Size = new Size(125, 34),
                BackColor = Color.FromArgb(200, 130, 0), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnInProgress.FlatAppearance.BorderSize = 0;
            btnInProgress.Click += (s, e) => UpdateStatus("In Progress");

            btnCompleted = new Button
            {
                Text = "Mark: Completed",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(754, 468), Size = new Size(118, 34),
                BackColor = Color.FromArgb(0, 140, 60), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnCompleted.FlatAppearance.BorderSize = 0;
            btnCompleted.Click += (s, e) => UpdateStatus("Completed");

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(10, 510), Size = new Size(860, 22),
                ForeColor = Color.DarkGreen, TextAlign = ContentAlignment.MiddleCenter
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop, lblO, dgvOrders, lblI, dgvItems,
                lblInfo, btnInProgress, btnCompleted, lblStatus
            });
        }

        private void LoadOrders()
        {
            string q = @"
                SELECT o.OrderID,
                       u.FullName              AS Customer,
                       o.TotalAmount           AS [Total (RM)],
                       o.Status,
                       CONVERT(varchar,o.OrderDate,120) AS [Order Date],
                       o.Notes
                FROM Orders o
                JOIN Users u ON o.CustomerID = u.UserID
                WHERE o.Status IN ('Pending','In Progress','Completed')
                ORDER BY CASE o.Status
                    WHEN 'Pending'     THEN 1
                    WHEN 'In Progress' THEN 2
                    ELSE 3 END, o.OrderDate DESC";
            dgvOrders.DataSource = DBHelper.ExecuteQuery(q);
            if (dgvOrders.Columns.Contains("OrderID"))
                dgvOrders.Columns["OrderID"].Visible = false;
        }

        private void DgvOrders_SelectionChanged(object sender, EventArgs e)
        {
            if (dgvOrders.SelectedRows.Count == 0) return;
            DataGridViewRow r = dgvOrders.SelectedRows[0];
            selectedOrderID = Convert.ToInt32(r.Cells["OrderID"].Value);
            selectedCurrentStatus = r.Cells["Status"].Value.ToString();
            lblInfo.Text = $"Order #{selectedOrderID} — Status: {selectedCurrentStatus} — Customer: {r.Cells["Customer"].Value}";
            lblInfo.ForeColor = Color.FromArgb(0, 140, 60);
            LoadOrderItems(selectedOrderID);
        }

        private void LoadOrderItems(int orderID)
        {
            string q = @"SELECT mi.ItemName AS Item, oi.Quantity, oi.UnitPrice AS [Unit Price (RM)], oi.Subtotal AS [Subtotal (RM)]
                         FROM OrderItems oi
                         JOIN MenuItems mi ON oi.MenuItemID = mi.MenuItemID
                         WHERE oi.OrderID = @ID";
            dgvItems.DataSource = DBHelper.ExecuteQuery(q,
                new SqlParameter[] { new SqlParameter("@ID", orderID) });
        }

        private void UpdateStatus(string newStatus)
        {
            if (selectedOrderID == -1)
            { lblStatus.Text = "Select an order first."; lblStatus.ForeColor = Color.Red; return; }

            if (selectedCurrentStatus == "Completed" || selectedCurrentStatus == "Cancelled")
            {
                lblStatus.Text = $"Cannot change a '{selectedCurrentStatus}' order.";
                lblStatus.ForeColor = Color.Red;
                return;
            }

            DBHelper.ExecuteNonQuery("UPDATE Orders SET Status=@S WHERE OrderID=@ID",
                new SqlParameter[] {
                    new SqlParameter("@S",  newStatus),
                    new SqlParameter("@ID", selectedOrderID) });

            lblStatus.Text = $"Order #{selectedOrderID} marked as '{newStatus}'.";
            lblStatus.ForeColor = Color.DarkGreen;
            selectedCurrentStatus = newStatus;
            LoadOrders();
        }
    }
}

