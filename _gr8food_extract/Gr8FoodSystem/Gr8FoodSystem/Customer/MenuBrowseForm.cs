using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Models;

namespace Gr8FoodSystem
{
    public class MenuBrowseForm : Form
    {
        private DataGridView dgvMenu, dgvCart;
        private Label lblBalance, lblCartTotal, lblStatus;
        private Button btnAddToCart, btnRemove, btnPlaceOrder;
        private ComboBox cmbCategory;

        // In-memory cart
        private List<OrderItem> cart = new List<OrderItem>();
        private DataTable menuData;

        public MenuBrowseForm()
        {
            InitializeComponent();
            LoadMenu();
        }

        private void InitializeComponent()
        {
            this.Text = "Browse Menu & Order";
            this.Size = new Size(980, 650);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(160, 50, 0), Dock = DockStyle.Top, Height = 55 };

            lblBalance = new Label
            {
                Text = $"E-Wallet Balance: RM {LoginForm.CurrentUser.WalletBalance:F2}",
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            };
            pnlTop.Controls.Add(lblBalance);

            // Category filter
            Label lblCat = new Label
            {
                Text = "Category:", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(10, 64), Size = new Size(75, 22)
            };
            cmbCategory = new ComboBox
            {
                Location = new Point(88, 62), Size = new Size(130, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };
            cmbCategory.Items.AddRange(new string[] { "All", "Breakfast", "Lunch", "Dinner", "Snacks", "Drinks" });
            cmbCategory.SelectedIndex = 0;
            cmbCategory.SelectedIndexChanged += (s, e) => FilterMenu();

            // Menu grid (left)
            Label lblM = new Label
            {
                Text = "Available Menu Items:", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(10, 94), Size = new Size(200, 20)
            };
            dgvMenu = new DataGridView
            {
                Location = new Point(10, 114), Size = new Size(480, 350),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.White, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9),
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            ThemeHelper.StyleGrid(dgvMenu);

            // Add to cart button
            btnAddToCart = new Button
            {
                Text = "Add to Cart  >>",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(500, 200), Size = new Size(120, 38),
                BackColor = Color.FromArgb(160, 50, 0), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnAddToCart.FlatAppearance.BorderSize = 0;
            btnAddToCart.Click += BtnAddToCart_Click;

            // Cart grid (right)
            Label lblC = new Label
            {
                Text = "Your Cart:", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(630, 94), Size = new Size(200, 20)
            };
            dgvCart = new DataGridView
            {
                Location = new Point(630, 114), Size = new Size(320, 350),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.WhiteSmoke, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9)
            };
            ThemeHelper.StyleGrid(dgvCart);

            btnRemove = new Button
            {
                Text = "Remove Selected",
                Font = new Font("Segoe UI", 9),
                Location = new Point(630, 472), Size = new Size(150, 30),
                BackColor = Color.FromArgb(180, 30, 30), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnRemove.FlatAppearance.BorderSize = 0;
            btnRemove.Click += BtnRemove_Click;

            lblCartTotal = new Label
            {
                Text = "Total: RM 0.00",
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                Location = new Point(630, 508), Size = new Size(320, 26),
                ForeColor = Color.FromArgb(160, 50, 0),
                TextAlign = ContentAlignment.MiddleRight
            };

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(10, 510), Size = new Size(610, 22),
                ForeColor = Color.Red
            };

            btnPlaceOrder = new Button
            {
                Text = "CONFIRM ORDER",
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                Location = new Point(630, 540), Size = new Size(320, 50),
                BackColor = Color.FromArgb(0, 140, 60), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnPlaceOrder.FlatAppearance.BorderSize = 0;
            btnPlaceOrder.Click += BtnPlaceOrder_Click;

            Label lblNote = new Label
            {
                Text = "Double-click a menu item to add quantity 1. Then press Add to Cart.",
                Font = new Font("Segoe UI", 8, FontStyle.Italic),
                Location = new Point(10, 472), Size = new Size(480, 22),
                ForeColor = Color.Gray
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop, lblCat, cmbCategory, lblM, dgvMenu,
                btnAddToCart, lblC, dgvCart, btnRemove,
                lblCartTotal, lblStatus, btnPlaceOrder, lblNote
            });
        }

        private void LoadMenu()
        {
            string q = @"SELECT MenuItemID, ItemName, Category,
                                CAST(Price AS DECIMAL(10,2)) AS [Price (RM)],
                                Description
                         FROM MenuItems
                         WHERE Status = 'Available'
                         ORDER BY Category, ItemName";
            menuData = DBHelper.ExecuteQuery(q);
            FilterMenu();
        }

        private void FilterMenu()
        {
            if (menuData == null) return;
            string filter = cmbCategory.SelectedIndex == 0
                ? "" : $"Category = '{cmbCategory.Text}'";
            DataView dv = menuData.DefaultView;
            dv.RowFilter = filter;
            dgvMenu.DataSource = dv.ToTable();
            if (dgvMenu.Columns.Contains("MenuItemID"))
                dgvMenu.Columns["MenuItemID"].Visible = false;
        }

        private void BtnAddToCart_Click(object sender, EventArgs e)
        {
            if (dgvMenu.SelectedRows.Count == 0)
            { ShowMsg("Select a menu item first."); return; }

            DataGridViewRow r = dgvMenu.SelectedRows[0];
            int menuItemID    = Convert.ToInt32(r.Cells["MenuItemID"].Value);
            string itemName   = r.Cells["ItemName"].Value.ToString();
            decimal price     = Convert.ToDecimal(r.Cells["Price (RM)"].Value);

            // Ask quantity
            string input = Microsoft.VisualBasic.Interaction.InputBox(
                $"How many '{itemName}'?", "Quantity", "1");
            if (string.IsNullOrWhiteSpace(input)) return;
            if (!int.TryParse(input, out int qty) || qty <= 0)
            { ShowMsg("Enter a valid quantity (positive number)."); return; }

            // Check if already in cart
            var existing = cart.Find(ci => ci.MenuItemID == menuItemID);
            if (existing != null)
            {
                existing.Quantity += qty;
                existing.Subtotal = existing.Quantity * existing.UnitPrice;
            }
            else
            {
                cart.Add(new OrderItem(menuItemID, itemName, qty, price));
            }

            RefreshCart();
        }

        private void BtnRemove_Click(object sender, EventArgs e)
        {
            if (dgvCart.SelectedRows.Count == 0) return;
            int idx = dgvCart.SelectedRows[0].Index;
            if (idx >= 0 && idx < cart.Count)
            {
                cart.RemoveAt(idx);
                RefreshCart();
            }
        }

        private void RefreshCart()
        {
            DataTable dt = new DataTable();
            dt.Columns.Add("Item");
            dt.Columns.Add("Qty");
            dt.Columns.Add("Price (RM)");
            dt.Columns.Add("Subtotal (RM)");

            decimal total = 0;
            foreach (var item in cart)
            {
                dt.Rows.Add(item.ItemName, item.Quantity,
                            item.UnitPrice.ToString("F2"),
                            item.Subtotal.ToString("F2"));
                total += item.Subtotal;
            }
            dgvCart.DataSource = dt;
            lblCartTotal.Text = $"Total: RM {total:F2}";
            lblStatus.Text = "";
        }

        private void BtnPlaceOrder_Click(object sender, EventArgs e)
        {
            if (cart.Count == 0)
            { ShowMsg("Your cart is empty. Add items first."); return; }

            User cust = LoginForm.CurrentUser;
            decimal total = 0;
            foreach (OrderItem item in cart)
            {
                total = total + item.Subtotal;
            }

            // Check the customer has enough money
            if (!cust.CanAfford(total))
            {
                ShowMsg($"Insufficient wallet balance. Balance: RM {cust.WalletBalance:F2}  |  Order: RM {total:F2}");
                return;
            }

            if (MessageBox.Show(
                $"Confirm order?\nTotal: RM {total:F2}\nBalance after: RM {cust.WalletBalance - total:F2}",
                "Confirm Order", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
                return;

            try
            {
                // Step 1: add the order and get back its new ID number
                string insertOrder = @"INSERT INTO Orders (CustomerID, TotalAmount, Status)
                                       VALUES (@CID, @Total, 'Pending');
                                       SELECT SCOPE_IDENTITY();";
                SqlParameter[] orderParams = new SqlParameter[]
                {
                    new SqlParameter("@CID", cust.UserID),
                    new SqlParameter("@Total", total)
                };
                object newIDObject = DBHelper.ExecuteScalar(insertOrder, orderParams);
                int newOrderID = Convert.ToInt32(newIDObject);

                // Step 2: add every item from the cart into the OrderItems table
                foreach (OrderItem item in cart)
                {
                    string insertItem = @"INSERT INTO OrderItems (OrderID,MenuItemID,Quantity,UnitPrice,Subtotal)
                                          VALUES (@OID,@MID,@Qty,@UPrice,@Sub)";
                    SqlParameter[] itemParams = new SqlParameter[]
                    {
                        new SqlParameter("@OID", newOrderID),
                        new SqlParameter("@MID", item.MenuItemID),
                        new SqlParameter("@Qty", item.Quantity),
                        new SqlParameter("@UPrice", item.UnitPrice),
                        new SqlParameter("@Sub", item.Subtotal)
                    };
                    DBHelper.ExecuteNonQuery(insertItem, itemParams);
                }

                // Step 3: take the money out of the customer's wallet
                string updateWallet = "UPDATE Customers SET WalletBalance = WalletBalance - @Amt WHERE CustomerID=@CID";
                SqlParameter[] walletParams = new SqlParameter[]
                {
                    new SqlParameter("@Amt", total),
                    new SqlParameter("@CID", cust.UserID)
                };
                DBHelper.ExecuteNonQuery(updateWallet, walletParams);

                // Step 4: save a record of this payment
                string insertTrans = @"INSERT INTO WalletTransactions (CustomerID,TransactionType,Amount,Description,OrderID)
                                       VALUES (@CID,'Deduction',@Amt,@Desc,@OID)";
                SqlParameter[] transParams = new SqlParameter[]
                {
                    new SqlParameter("@CID", cust.UserID),
                    new SqlParameter("@Amt", total),
                    new SqlParameter("@Desc", "Payment for Order #" + newOrderID),
                    new SqlParameter("@OID", newOrderID)
                };
                DBHelper.ExecuteNonQuery(insertTrans, transParams);

                // Update the balance shown on the screen
                cust.Deduct(total);
                lblBalance.Text = $"E-Wallet Balance: RM {cust.WalletBalance:F2}";

                MessageBox.Show($"Order #{newOrderID} placed successfully!\nRM {total:F2} deducted from your wallet.",
                    "Order Placed", MessageBoxButtons.OK, MessageBoxIcon.Information);
                cart.Clear();
                RefreshCart();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error placing order:\n" + ex.Message, "Error",
                                MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void ShowMsg(string msg)
        {
            lblStatus.Text = msg;
            lblStatus.ForeColor = Color.Red;
        }
    }
}


