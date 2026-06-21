# -*- coding: utf-8 -*-
"""Generates a Russian PDF cheat-sheet explaining Bekzat's Admin + Customer code."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether)
import html as _html

# ---- Fonts (Cyrillic support) ----
pdfmetrics.registerFont(TTFont("Body", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Body-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Mono", r"C:\Windows\Fonts\consola.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold")

# ---- Colors ----
NAVY   = colors.HexColor("#1f3b66")
ORANGE = colors.HexColor("#a8500a")
CODEBG = colors.HexColor("#f4f6f9")
CODEBD = colors.HexColor("#d4dae3")
GREEN  = colors.HexColor("#0a7a3c")
GREY   = colors.HexColor("#555555")

styles = getSampleStyleSheet()

def S(name, **kw):
    base = dict(fontName="Body", fontSize=10.5, leading=15, textColor=colors.black,
                alignment=TA_LEFT, spaceBefore=0, spaceAfter=0)
    base.update(kw)
    return ParagraphStyle(name, **base)

st_title  = S("title",  fontName="Body-Bold", fontSize=24, leading=28, textColor=NAVY)
st_sub    = S("sub",    fontSize=12, textColor=GREY, leading=16)
st_h1      = S("h1",    fontName="Body-Bold", fontSize=17, leading=21, textColor=colors.white)
st_h2     = S("h2",     fontName="Body-Bold", fontSize=13.5, leading=18, textColor=NAVY,
              spaceBefore=10, spaceAfter=4)
st_body   = S("body",   spaceAfter=4)
st_say    = S("say",    fontSize=10.5, leading=15, textColor=ORANGE, fontName="Body-Bold",
              spaceBefore=2, spaceAfter=6)
st_bullet = S("bullet", fontSize=10, leading=14, leftIndent=14, spaceAfter=2)
st_note   = S("note",   fontSize=9.5, leading=13, textColor=GREY)
st_code   = S("code",   fontName="Mono", fontSize=8.6, leading=11.6, textColor=colors.HexColor("#202830"))

story = []

def band(text):
    """Colored section band (h1)."""
    p = Paragraph(text, st_h1)
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), NAVY),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    story.append(Spacer(1, 8))
    story.append(t)
    story.append(Spacer(1, 6))

def h2(text):
    story.append(Paragraph(text, st_h2))

def body(text):
    story.append(Paragraph(text, st_body))

def say(text):
    story.append(Paragraph("&#128172; <i>«%s»</i>" % text, st_say))

def bullets(items):
    for it in items:
        story.append(Paragraph("&bull; " + it, st_bullet))

def code(src):
    src = src.rstrip("\n")
    safe = _html.escape(src).replace(" ", "&nbsp;").replace("\n", "<br/>")
    p = Paragraph(safe, st_code)
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CODEBG),
        ("BOX", (0,0), (-1,-1), 0.6, CODEBD),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(Spacer(1, 2))
    story.append(t)
    story.append(Spacer(1, 4))

def gap(h=6):
    story.append(Spacer(1, h))

# =================== TITLE ===================
story.append(Spacer(1, 40))
story.append(Paragraph("Gr8Food System", st_title))
story.append(Spacer(1, 4))
story.append(Paragraph("Шпаргалка для защиты &mdash; мои части: <b>Admin</b> и <b>Customer</b>", st_sub))
story.append(Spacer(1, 2))
story.append(Paragraph("Бекзат &middot; объяснение каждой конструкции кода", st_note))
gap(14)

# =================== GLOSSARY ===================
band("&#128218; ЧАСТЬ 0. Базовые слова C# (что они значат)")
body("Это слова, которые встречаются в КАЖДОМ моём файле. Если спросят &laquo;что тут написано&raquo; &mdash; отвечаю так:")
gap(4)

glossary = [
    ("public class AdminDashboard : Form",
     "<b>class</b> &mdash; это &laquo;чертёж&raquo; объекта. <b>public</b> &mdash; класс виден из любого места программы. "
     "<b>: Form</b> &mdash; мой класс &laquo;является окном&raquo;, он берёт всё готовое от стандартного окна Windows (кнопки, рамку, заголовок)."),
    ("private void BtnAdd_Click(object sender, EventArgs e)",
     "<b>private</b> &mdash; метод виден только внутри этого класса (наружу спрятан). <b>void</b> &mdash; метод ничего не возвращает, просто выполняет действие. "
     "<b>BtnAdd_Click</b> &mdash; имя метода (запускается по клику). <b>(object sender, EventArgs e)</b> &mdash; стандартные параметры события: кто нажал и подробности."),
    ("private bool ValidateInputs(bool requirePassword)",
     "<b>bool</b> вместо void &mdash; метод <b>возвращает</b> значение true/false (да/нет). Использую, чтобы проверить ввод и сказать &laquo;всё ок&raquo; или &laquo;ошибка&raquo;."),
    ("string q = \"...\";   int qty;   decimal total;",
     "Типы данных: <b>string</b> &mdash; текст, <b>int</b> &mdash; целое число, <b>decimal</b> &mdash; число с копейками (деньги), <b>bool</b> &mdash; да/нет."),
    ("UserManagementForm form = new UserManagementForm();",
     "<b>new</b> &mdash; создаю новый объект (экземпляр) из класса-чертежа. Здесь создаю новое окно и кладу его в переменную form."),
    ("btnAdd.Click += BtnAdd_Click;",
     "<b>+=</b> на событии &mdash; это &laquo;подписка&raquo;. Я говорю: когда кнопку нажмут (событие Click), запусти мой метод BtnAdd_Click."),
    ("if (...) { ... } else { ... }",
     "<b>if</b> &mdash; условие &laquo;если&raquo;. Код в фигурных скобках выполнится, только если условие истинно. <b>else</b> &mdash; иначе."),
    ("foreach (DataRow row in dt.Rows) { ... }",
     "<b>foreach</b> &mdash; цикл: &laquo;для каждого элемента в коллекции сделай...&raquo;. Здесь прохожу по всем строкам таблицы."),
    ("return;",
     "<b>return</b> &mdash; выйти из метода прямо сейчас. Использую после ошибки, чтобы дальше код не выполнялся."),
    ("try { ... } catch (Exception ex) { ... }",
     "<b>try/catch</b> &mdash; защита от падения. Код в try пробуем выполнить; если случилась ошибка (Exception) &mdash; переходим в catch и показываем сообщение, а программа не вылетает."),
    ("$\"Balance: RM {bal:F2}\"",
     "<b>$\"...\"</b> &mdash; строка со вставкой переменных прямо в текст. <b>{bal:F2}</b> &mdash; показать число с 2 знаками после запятой."),
    ("@\"SELECT * FROM Users\"",
     "<b>@\"...\"</b> &mdash; многострочная строка. Удобно писать длинный SQL-запрос на несколько строк."),
    ("new SqlParameter(\"@L\", txtLoginID.Text)",
     "<b>SqlParameter</b> &mdash; безопасная подстановка значения в SQL. Вместо склейки текста я передаю параметр &mdash; это <b>защита от SQL-инъекций</b>."),
]
for c, expl in glossary:
    code(c)
    story.append(Paragraph(expl, st_bullet))
    gap(5)

story.append(PageBreak())

# =================== ADMIN ===================
band("&#129351; РОЛЬ ADMIN")
body("Админ управляет пользователями и смотрит отчёты. Три формы: дашборд, управление пользователями, отчёт о продажах.")

# --- AdminDashboard ---
h2("1. AdminDashboard.cs &mdash; главное меню админа")
body("Это окно с кнопками-навигацией. Ничего не считает &mdash; только открывает другие окна.")
code(
'btnUsers.Click += BtnUsers_Click;\n'
'btnSales.Click += BtnSales_Click;\n'
'btnProfile.Click += BtnProfile_Click;\n'
'btnLogout.Click += BtnLogout_Click;')
bullets([
    "<b>+=</b> &mdash; подписываю каждую кнопку на свой метод. Нажали кнопку &rarr; запустился метод.",
])
say("Каждая кнопка через событие Click открывает свою форму.")
code(
'private void BtnUsers_Click(object sender, EventArgs e)\n'
'{\n'
'    UserManagementForm form = new UserManagementForm();\n'
'    form.ShowDialog();\n'
'}')
bullets([
    "<b>new UserManagementForm()</b> &mdash; создаю окно управления пользователями.",
    "<b>ShowDialog()</b> &mdash; открываю его модально (поверх, пока не закрою &mdash; назад не вернусь).",
])
code(
'DialogResult answer = MessageBox.Show("Logout?", "Confirm", MessageBoxButtons.YesNo);\n'
'if (answer == DialogResult.Yes)\n'
'{\n'
'    this.Close();\n'
'}')
bullets([
    "<b>MessageBox.Show</b> &mdash; всплывающее окно с Yes/No.",
    "<b>if (answer == DialogResult.Yes)</b> &mdash; если нажали Yes &mdash; <b>this.Close()</b> закрывает окно (выход).",
])

# --- UserManagementForm ---
story.append(PageBreak())
h2("2. UserManagementForm.cs &mdash; CRUD пользователей (главная форма админа)")
body("CRUD = Create/Read/Update/Delete: добавить, показать, изменить, деактивировать пользователя. Это самая важная моя форма.")

say("Загружаю всех пользователей в таблицу.")
code(
'string q = @"SELECT UserID, LoginID, Role, FullName, Email, PhoneNumber,\n'
'                    CASE WHEN IsActive=1 THEN \'Active\' ELSE \'Inactive\' END AS Status\n'
'             FROM Users ORDER BY Role, FullName";\n'
'dgvUsers.DataSource = DBHelper.ExecuteQuery(q);\n'
'dgvUsers.Columns["UserID"].Visible = false;')
bullets([
    "<b>CASE WHEN IsActive=1 ...</b> &mdash; в SQL превращаю 1/0 в понятный текст Active/Inactive.",
    "<b>DBHelper.ExecuteQuery(q)</b> &mdash; мой общий метод: выполняет SELECT и возвращает таблицу данных.",
    "<b>.Visible = false</b> &mdash; колонку UserID прячу от глаз, она нужна только программе.",
])

say("Перед добавлением проверяю, не занят ли логин.")
code(
'var check = DBHelper.ExecuteScalar(\n'
'    "SELECT COUNT(*) FROM Users WHERE LoginID=@L",\n'
'    new SqlParameter[] { new SqlParameter("@L", txtLoginID.Text.Trim()) });\n'
'\n'
'if (Convert.ToInt32(check) > 0)\n'
'{\n'
'    ShowStatus("Login ID already exists.", Color.Red);\n'
'    return;\n'
'}')
bullets([
    "<b>ExecuteScalar</b> &mdash; возвращает ОДНО значение (тут COUNT &mdash; сколько таких логинов).",
    "<b>Convert.ToInt32(check) &gt; 0</b> &mdash; если хоть один есть &mdash; логин занят, показываю ошибку и <b>return</b> (выходим, не добавляем).",
])

say("Добавляю пользователя &mdash; запрос параметризованный (защита от инъекций).")
code(
'string q = @"INSERT INTO Users (LoginID,Password,Role,FullName,Email,PhoneNumber)\n'
'             VALUES (@L,@P,@R,@F,@E,@Ph)";\n'
'SqlParameter[] p =\n'
'{\n'
'    new SqlParameter("@L",  txtLoginID.Text.Trim()),\n'
'    new SqlParameter("@P",  txtPassword.Text),\n'
'    new SqlParameter("@R",  cmbRole.Text),\n'
'    ...\n'
'};\n'
'DBHelper.ExecuteNonQuery(q, p);')
bullets([
    "<b>INSERT INTO ... VALUES (@L,@P,...)</b> &mdash; вместо реальных значений ставлю @-метки.",
    "<b>SqlParameter[]</b> &mdash; массив параметров: каждая @-метка получает значение отдельно &rarr; <b>защита от SQL-инъекций</b>.",
    "<b>ExecuteNonQuery</b> &mdash; мой метод для запросов, которые меняют данные (INSERT/UPDATE/DELETE).",
])

say("Если новый пользователь &mdash; Customer, сразу создаю ему кошелёк.")
code(
'if (cmbRole.Text == "Customer")\n'
'{\n'
'    var newID = DBHelper.ExecuteScalar("SELECT MAX(UserID) FROM Users");\n'
'    DBHelper.ExecuteNonQuery(\n'
'        "INSERT INTO Customers (CustomerID, WalletBalance) VALUES (@ID, 0)",\n'
'        new SqlParameter[] { new SqlParameter("@ID", Convert.ToInt32(newID)) });\n'
'}')
bullets([
    "<b>SELECT MAX(UserID)</b> &mdash; беру ID только что добавленного пользователя.",
    "Создаю строку в таблице Customers с балансом 0 &mdash; это <b>связь двух таблиц</b> Users и Customers.",
])

say("Удаление мягкое: не стираю, а ставлю IsActive=0.")
code(
'DBHelper.ExecuteNonQuery(\n'
'    "UPDATE Users SET IsActive=0 WHERE UserID=@ID",\n'
'    new SqlParameter[] { new SqlParameter("@ID", selectedUserID) });')
bullets([
    "Физически не удаляю &mdash; иначе потеряю историю заказов. Просто помечаю как неактивного (<b>soft delete</b>).",
])

# --- SalesReportForm ---
story.append(PageBreak())
h2("3. SalesReportForm.cs &mdash; отчёт о продажах с фильтрами")
body("Отчёт по завершённым заказам. Фильтры: месяц, год, категория, повар. Внизу &mdash; общая сумма.")

say("Условие WHERE собираю динамически &mdash; добавляю фильтр только если он выбран.")
code(
'string where = "WHERE o.Status = \'Completed\'";\n'
'var pList = new System.Collections.Generic.List<SqlParameter>();\n'
'\n'
'if (cmbMonth.SelectedIndex > 0)\n'
'{\n'
'    where += " AND MONTH(o.OrderDate) = @Month";\n'
'    pList.Add(new SqlParameter("@Month", cmbMonth.SelectedIndex));\n'
'}')
bullets([
    "<b>List&lt;SqlParameter&gt;</b> &mdash; список параметров, который растёт по мере добавления фильтров.",
    "<b>SelectedIndex &gt; 0</b> &mdash; индекс 0 это &laquo;All&raquo;; если выбрано не All &mdash; дописываю условие в WHERE и добавляю параметр.",
    "<b>where += ...</b> &mdash; дописываю кусок к строке запроса.",
])

say("Сам отчёт &mdash; это соединение (JOIN) нескольких таблиц.")
code(
'FROM Orders o\n'
'JOIN OrderItems oi ON o.OrderID = oi.OrderID\n'
'JOIN MenuItems mi  ON oi.MenuItemID = mi.MenuItemID\n'
'JOIN Users u       ON o.CustomerID = u.UserID\n'
'JOIN Users uc      ON mi.ChefID = uc.UserID')
bullets([
    "<b>JOIN</b> &mdash; склеиваю таблицы по общему полю (ON ...).",
    "Users подключаю дважды: <b>u</b> &mdash; клиент заказа, <b>uc</b> &mdash; повар блюда.",
])

say("В конце суммирую все строки и показываю Total.")
code(
'decimal total = 0;\n'
'foreach (DataRow row in dt.Rows)\n'
'    total += Convert.ToDecimal(row["Subtotal (RM)"]);\n'
'lblTotal.Text = $"Total Sales: RM {total:F2}";')
bullets([
    "<b>foreach</b> прохожу по всем строкам, <b>total +=</b> прибавляю каждую сумму.",
    "<b>{total:F2}</b> &mdash; вывожу с двумя знаками после запятой.",
])

# =================== CUSTOMER ===================
story.append(PageBreak())
band("&#129382; РОЛЬ CUSTOMER")
body("Клиент пополняет кошелёк, заказывает еду, смотрит/отменяет заказы и оставляет отзывы. Главная идея &mdash; электронный кошелёк (E-Wallet).")

# --- CustomerDashboard ---
h2("1. CustomerDashboard.cs &mdash; меню клиента")
say("После закрытия любого окна обновляю баланс &mdash; вдруг он изменился.")
code(
'b1.Click += (s,e)=>{ var f=new MenuBrowseForm();\n'
'                     f.FormClosed+=(ss,ee)=>RefreshBalance(); f.ShowDialog(); };')
bullets([
    "<b>(s,e)=&gt;{...}</b> &mdash; лямбда, короткий способ написать метод прямо на месте.",
    "<b>FormClosed += ...RefreshBalance()</b> &mdash; когда окно закроется, перечитать баланс из БД.",
])
code(
'var row=DBHelper.ExecuteQuery("SELECT WalletBalance FROM Customers WHERE CustomerID=@ID",\n'
'    new SqlParameter[]{new SqlParameter("@ID",LoginForm.CurrentUser.UserID)});\n'
'if(row.Rows.Count>0){\n'
'    decimal bal=Convert.ToDecimal(row.Rows[0]["WalletBalance"]);\n'
'    lblBalance.Text=$"E-Wallet Balance: RM {bal:F2}"; }')
bullets([
    "<b>LoginForm.CurrentUser.UserID</b> &mdash; ID того, кто вошёл (храню глобально после логина).",
    "<b>row.Rows.Count&gt;0</b> &mdash; проверяю, что строка нашлась, и только потом читаю баланс.",
])

# --- WalletTopUp ---
h2("2. WalletTopUpForm.cs &mdash; пополнение кошелька")
say("Сначала проверяю сумму: положительная и не больше 500.")
code(
'if (!decimal.TryParse(txtAmount.Text.Trim(), out decimal amount) || amount <= 0)\n'
'{ lblStatus.Text = "Please enter a valid positive amount."; return; }\n'
'\n'
'if (amount > 500)\n'
'{ lblStatus.Text = "Maximum top up per transaction is RM 500."; return; }')
bullets([
    "<b>decimal.TryParse(...)</b> &mdash; пробую превратить текст в число. Вернёт false, если ввели не число.",
    "<b>out decimal amount</b> &mdash; сюда кладётся полученное число.",
    "<b>!</b> (восклицательный знак) &mdash; &laquo;НЕ&raquo;: если НЕ получилось распарсить ИЛИ сумма &le; 0 &mdash; ошибка.",
])
say("Пополняю баланс и записываю транзакцию &mdash; веду историю.")
code(
'DBHelper.ExecuteNonQuery(\n'
'    "UPDATE Customers SET WalletBalance = WalletBalance + @Amt WHERE CustomerID=@ID",\n'
'    new SqlParameter[]{ new SqlParameter("@Amt",amount), new SqlParameter("@ID",custID) });\n'
'\n'
'DBHelper.ExecuteNonQuery(\n'
'    @"INSERT INTO WalletTransactions (CustomerID,TransactionType,Amount,Description)\n'
'      VALUES (@ID,\'TopUp\',@Amt,\'Wallet top up\')", ...);')
bullets([
    "<b>WalletBalance = WalletBalance + @Amt</b> &mdash; прибавляю сумму к текущему балансу в БД.",
    "Вторым запросом пишу запись в WalletTransactions с типом <b>TopUp</b> &mdash; чтобы была история операций.",
])

# --- MenuBrowse ---
story.append(PageBreak())
h2("3. MenuBrowseForm.cs &mdash; меню, корзина, заказ (самая сложная форма)")
say("Корзину держу в памяти как список, пока клиент не подтвердит.")
code('private List<OrderItem> cart = new List<OrderItem>();')
bullets([
    "<b>List&lt;OrderItem&gt;</b> &mdash; список объектов &laquo;позиция заказа&raquo;. В БД пишу только после подтверждения.",
])
say("Если товар уже в корзине &mdash; увеличиваю количество, а не добавляю заново.")
code(
'var existing = cart.Find(ci => ci.MenuItemID == menuItemID);\n'
'if (existing != null)\n'
'{\n'
'    existing.Quantity += qty;\n'
'    existing.Subtotal = existing.Quantity * existing.UnitPrice;\n'
'}\n'
'else\n'
'{\n'
'    cart.Add(new OrderItem(menuItemID, itemName, qty, price));\n'
'}')
bullets([
    "<b>cart.Find(ci =&gt; ...)</b> &mdash; ищу в корзине товар с таким же ID.",
    "<b>!= null</b> &mdash; если нашёлся (не пусто) &mdash; увеличиваю Quantity; <b>else</b> &mdash; добавляю новый.",
])
say("Перед заказом проверяю, хватает ли денег.")
code(
'if (!cust.CanAfford(total))\n'
'{\n'
'    ShowMsg($"Insufficient wallet balance. Balance: RM {cust.WalletBalance:F2}...");\n'
'    return;\n'
'}')
bullets([
    "<b>CanAfford(total)</b> &mdash; мой метод из класса User: возвращает true, если денег хватает.",
])
say("Оформляю заказ в БД в 4 шага.")
code(
'// Шаг 1: создаю заказ и беру его новый ID\n'
'string insertOrder = @"INSERT INTO Orders (CustomerID, TotalAmount, Status)\n'
'                       VALUES (@CID, @Total, \'Pending\');\n'
'                       SELECT SCOPE_IDENTITY();";\n'
'int newOrderID = Convert.ToInt32(DBHelper.ExecuteScalar(insertOrder, orderParams));\n'
'\n'
'// Шаг 2: добавляю все позиции корзины в OrderItems\n'
'foreach (OrderItem item in cart) { ... INSERT INTO OrderItems ... }\n'
'\n'
'// Шаг 3: списываю деньги с кошелька\n'
'"UPDATE Customers SET WalletBalance = WalletBalance - @Amt WHERE CustomerID=@CID"\n'
'\n'
'// Шаг 4: пишу транзакцию типа Deduction\n'
'INSERT INTO WalletTransactions (...) VALUES (@CID,\'Deduction\',@Amt,...)')
bullets([
    "<b>SCOPE_IDENTITY()</b> &mdash; возвращает ID только что вставленного заказа. Нужен, чтобы привязать к нему позиции.",
    "<b>foreach</b> по корзине &mdash; каждую позицию записываю в OrderItems с этим OrderID.",
    "Списываю деньги и пишу транзакцию <b>Deduction</b> (расход).",
])
say("Весь заказ обёрнут в try/catch &mdash; чтобы программа не упала при ошибке БД.")
code(
'try { ... весь заказ ... }\n'
'catch (Exception ex)\n'
'{\n'
'    MessageBox.Show("Error placing order:\\n" + ex.Message, "Error", ...);\n'
'}')

# --- OrderHistory ---
story.append(PageBreak())
h2("4. OrderHistoryForm.cs &mdash; история и отмена с возвратом денег")
say("Отменить можно только заказ в статусе Pending или In Progress.")
code(
'if (selectedStatus != "Pending" && selectedStatus != "In Progress")\n'
'{\n'
'    SetStatus($"Cannot cancel a \'{selectedStatus}\' order.", Color.Red);\n'
'    return;\n'
'}')
bullets([
    "<b>&amp;&amp;</b> &mdash; логическое И: оба условия должны быть истинны.",
    "Если статус не Pending И не In Progress &mdash; отмену запрещаю.",
])
say("Отмена в 3 шага: статус, возврат денег, транзакция.")
code(
'// Шаг 1: меняю статус на Cancelled\n'
'"UPDATE Orders SET Status=\'Cancelled\' WHERE OrderID=@ID"\n'
'\n'
'// Шаг 2: возвращаю деньги на кошелёк\n'
'"UPDATE Customers SET WalletBalance = WalletBalance + @Amt WHERE CustomerID=@CID"\n'
'\n'
'// Шаг 3: пишу транзакцию Refund (возврат)\n'
'INSERT INTO WalletTransactions (...) VALUES (@CID,\'Refund\',@Amt,...)')
bullets([
    "<b>WalletBalance + @Amt</b> &mdash; в отличие от заказа, тут ПРИБАВЛЯЮ деньги обратно.",
    "Транзакция типа <b>Refund</b> &mdash; для истории.",
])

# --- Feedback ---
h2("5. FeedbackSubmitForm.cs &mdash; отзывы")
say("Показываю только завершённые заказы, на которые ещё НЕТ отзыва.")
code(
'WHERE o.CustomerID = @CID\n'
'  AND o.Status = \'Completed\'\n'
'  AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.OrderID = o.OrderID)')
bullets([
    "<b>NOT EXISTS (...)</b> &mdash; &laquo;если по этому заказу ещё нет записи в Feedback&raquo;. Не даю оставить два отзыва на один заказ.",
])
say("Проверяю длину отзыва и сохраняю.")
code(
'if (txtMessage.Text.Trim().Length < 10)\n'
'{ SetStatus("Feedback must be at least 10 characters.", Color.Red); return; }\n'
'\n'
'int rating = 5 - cmbRating.SelectedIndex; // 5,4,3,2,1\n'
'string q = @"INSERT INTO Feedback (CustomerID, OrderID, Message, Rating)\n'
'             VALUES (@CID, @OID, @Msg, @R)";')
bullets([
    "<b>.Length &lt; 10</b> &mdash; не пускаю слишком короткий отзыв.",
    "<b>5 - SelectedIndex</b> &mdash; превращаю позицию в списке в оценку 5..1.",
])

# =================== Q&A ===================
story.append(PageBreak())
band("&#127919; Частые вопросы на защите (готовь ответы)")
qa = [
    ("Почему нет наследования?",
     "По заданию не требовалось. Один класс User с полем Role &mdash; роль определяет, какой дашборд открыть."),
    ("Как защищаетесь от SQL-инъекций?",
     "Все запросы параметризованные через SqlParameter. Значения не склеиваю в текст запроса."),
    ("Что такое DBHelper?",
     "Общий класс для БД. 3 метода: ExecuteQuery (SELECT &rarr; таблица), ExecuteNonQuery (INSERT/UPDATE/DELETE), "
     "ExecuteScalar (одно значение). Сделан, чтобы не дублировать код подключения в каждой форме."),
    ("В чём разница ExecuteQuery / ExecuteNonQuery / ExecuteScalar?",
     "Query &mdash; когда нужны строки данных. NonQuery &mdash; когда меняю данные (возвращает число строк). "
     "Scalar &mdash; когда нужно одно значение (COUNT, MAX, новый ID)."),
    ("Зачем SCOPE_IDENTITY()?",
     "Чтобы получить ID только что созданного заказа и привязать к нему позиции в OrderItems."),
    ("Что значит ShowDialog()?",
     "Открыть окно модально &mdash; поверх текущего, пока его не закроют."),
    ("Как связаны таблицы?",
     "Users &rarr; Customers (кошелёк); Orders &rarr; OrderItems &rarr; MenuItems; плюс WalletTransactions и Feedback."),
    ("Что такое soft delete?",
     "Мягкое удаление: ставлю IsActive=0 вместо физического DELETE, чтобы сохранить историю."),
]
for q, a in qa:
    story.append(Paragraph("<b>В:</b> " + q, st_body))
    story.append(Paragraph("<font color='#0a7a3c'><b>О:</b></font> " + a, st_bullet))
    gap(6)

# ---- Build ----
doc = SimpleDocTemplate(
    r"C:\Users\mufta\Downloads\Gr8Food_Cheatsheet_Bekzat.pdf",
    pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
    topMargin=16*mm, bottomMargin=16*mm,
    title="Gr8Food Cheatsheet - Admin & Customer")

def footer(canvas, doc_):
    canvas.saveState()
    canvas.setFont("Body", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(20*mm, 10*mm, "Gr8Food System  -  шпаргалка (Admin & Customer)")
    canvas.drawRightString(190*mm, 10*mm, "Стр. %d" % doc_.page)
    canvas.restoreState()

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("PDF created OK")
