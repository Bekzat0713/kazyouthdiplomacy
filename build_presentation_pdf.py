# -*- coding: utf-8 -*-
"""Gr8Food — Presentation Prep PDF generator."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# ---------- Fonts (Cyrillic support) ----------
pdfmetrics.registerFont(TTFont("Body", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("Body-B", "C:/Windows/Fonts/arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Body-I", "C:/Windows/Fonts/ariali.ttf"))
pdfmetrics.registerFont(TTFont("Mono", "C:/Windows/Fonts/consola.ttf"))
pdfmetrics.registerFont(TTFont("Mono-B", "C:/Windows/Fonts/consolab.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-B", italic="Body-I")

# ---------- Palette ----------
NAVY   = colors.HexColor("#1F2D3D")
BLUE   = colors.HexColor("#2980B9")
GREEN  = colors.HexColor("#27AE60")
ORANGE = colors.HexColor("#E67E22")
PURPLE = colors.HexColor("#8E44AD")
RED    = colors.HexColor("#C0392B")
LIGHT  = colors.HexColor("#F4F6F8")
LIGHTB = colors.HexColor("#EAF2F8")
GREY   = colors.HexColor("#7F8C8D")
CODEBG = colors.HexColor("#2D3436")

# ---------- Styles ----------
ss = getSampleStyleSheet()

def S(name, **kw):
    base = kw.pop("parent", ss["Normal"])
    kw.setdefault("fontName", "Body")
    return ParagraphStyle(name, parent=base, **kw)

st_h1     = S("h1", fontName="Body-B", fontSize=18, textColor=NAVY, spaceBefore=4, spaceAfter=10, leading=22)
st_h2     = S("h2", fontName="Body-B", fontSize=13, textColor=colors.white, leading=16)
st_h3     = S("h3", fontName="Body-B", fontSize=11.5, textColor=NAVY, spaceBefore=10, spaceAfter=4, leading=14)
st_body   = S("body", fontSize=10, leading=15, spaceAfter=4)
st_small  = S("small", fontSize=9, leading=13, textColor=GREY)
st_say    = S("say", fontSize=9.5, leading=14, textColor=colors.HexColor("#145A32"),
              fontName="Body-I", leftIndent=8, spaceAfter=3)
st_cell   = S("cell", fontSize=9, leading=12)
st_cellb  = S("cellb", fontName="Body-B", fontSize=9, leading=12)
st_cellw  = S("cellw", fontSize=9, leading=12, textColor=colors.white, fontName="Body-B")
st_code   = S("code", fontName="Mono", fontSize=8.5, leading=12, textColor=colors.white)
st_step   = S("step", fontName="Mono", fontSize=9, leading=14, textColor=NAVY)
st_cover_t= S("ct", fontName="Body-B", fontSize=30, textColor=colors.white, alignment=TA_CENTER, leading=36)
st_cover_s= S("cs", fontSize=14, textColor=colors.HexColor("#BDC3C7"), alignment=TA_CENTER, leading=20)

story = []

def band(text, color):
    """Colored section header band."""
    t = Table([[Paragraph(text, st_h2)]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), color),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("ROUNDEDCORNERS", [4,4,4,4]),
    ]))
    return t

def code_block(lines):
    txt = "<br/>".join(lines)
    p = Paragraph(txt, st_code)
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CODEBG),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    return t

def info_table(rows, head, widths, headcolor):
    data = [[Paragraph(h, st_cellw) for h in head]]
    for r in rows:
        data.append([Paragraph(c, st_cell) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0,0), (-1,0), headcolor),
        ("FONTNAME", (0,0), (-1,-1), "Body"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 7),
        ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("LINEBELOW", (0,0), (-1,-1), 0.4, colors.HexColor("#D5DBDB")),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
        ("LINEAFTER", (0,0), (-2,-1), 0.4, colors.HexColor("#D5DBDB")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#BDC3C7")),
    ]
    t.setStyle(TableStyle(style))
    return t

def qa(q, a):
    out = [Paragraph("Q: " + q, S("q", fontName="Body-B", fontSize=10, leading=14, textColor=BLUE, spaceBefore=7))]
    out.append(Paragraph("A: " + a, S("a", fontSize=9.5, leading=14, spaceAfter=2)))
    return KeepTogether(out)

def say(text):
    return Paragraph('<font color="#27AE60"><b>&#187;</b></font> ' + text, st_say)

# ============================================================
# COVER
# ============================================================
cover = Table([[ "" ]], colWidths=[210*mm], rowHeights=[297*mm])
story_cover = []
story.append(Spacer(1, 70*mm))
story.append(Paragraph("Gr8Food", st_cover_t))
story.append(Paragraph("Management System", st_cover_t))
story.append(Spacer(1, 8*mm))
story.append(Paragraph("Presentation &amp; Defense Guide", st_cover_s))
story.append(Paragraph("C# Windows Forms &middot; SQL Server LocalDB &middot; OOP", st_cover_s))
story.append(Spacer(1, 20*mm))

team = Table([
    [Paragraph("<b>Admin / Customer</b>", st_cell), Paragraph("Bekzat", st_cell)],
    [Paragraph("<b>Manager</b>", st_cell), Paragraph("Matzhan", st_cell)],
    [Paragraph("<b>Chef</b>", st_cell), Paragraph("Erbolat", st_cell)],
], colWidths=[55*mm, 55*mm])
team.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), "Body"),
    ("FONTSIZE", (0,0), (-1,-1), 11),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("TOPPADDING", (0,0), (-1,-1), 8),
    ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ("BACKGROUND", (0,0), (0,-1), LIGHTB),
    ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT]),
    ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#BDC3C7")),
    ("LINEBELOW", (0,0), (-1,-1), 0.4, colors.HexColor("#D5DBDB")),
    ("HALIGN", (0,0), (-1,-1), "CENTER"),
]))
story.append(Table([[team]], colWidths=[170*mm],
    style=[("ALIGN",(0,0),(-1,-1),"CENTER")]))
story.append(PageBreak())

# ============================================================
# 1. LOGIN CREDENTIALS
# ============================================================
story.append(Paragraph("1. Доступы для входа (Login Credentials)", st_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#D5DBDB"), spaceAfter=8))
story.append(info_table(
    [
        ["Admin",    "admin001",   "Admin@123", "Bekzat"],
        ["Manager",  "manager001", "Mgr@123",   "Matzhan"],
        ["Chef",     "chef001",    "Chef@123",  "Erbolat"],
        ["Customer", "cust001",    "Cust@123",  "Bekzat"],
    ],
    ["Роль", "Login ID", "Password", "Кто показывает"],
    [40*mm, 45*mm, 45*mm, 40*mm], NAVY))
story.append(Spacer(1, 6))
story.append(Paragraph("Перед записью/презентацией: запусти программу, проверь что база данных работает и в меню есть блюда (категории Breakfast / Lunch / Dinner / Snacks / Drinks).", st_small))
story.append(PageBreak())

# ============================================================
# 2. ARCHITECTURE OVERVIEW
# ============================================================
story.append(Paragraph("2. Как устроен проект (Architecture)", st_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#D5DBDB"), spaceAfter=8))
story.append(Paragraph("Главный принцип ООП — <b>наследование (inheritance)</b>. Все 4 роли наследуют от базового класса <b>User</b>.", st_body))
story.append(code_block([
    "User  (base class)",
    "  |-- Admin    : User",
    "  |-- Manager  : User",
    "  |-- Chef     : User",
    "  |-- Customer : User   (+ WalletBalance, CanAfford, Deduct, Refund)",
]))
story.append(Spacer(1, 8))
story.append(Paragraph("Вспомогательные static-классы (используются всеми формами):", st_h3))
story.append(info_table(
    [
        ["DBHelper",        "Все запросы к БД: ExecuteQuery / ExecuteNonQuery / ExecuteScalar"],
        ["ValidationHelper","Проверка email, телефона, пароля, цены, количества (Regex)"],
        ["ThemeHelper",     "Единый стиль интерфейса: цвета, кнопки, заголовки, таблицы"],
        ["LoginForm.CurrentUser", "Static — текущий вошедший пользователь, доступен везде"],
    ],
    ["Класс", "За что отвечает"],
    [55*mm, 115*mm], BLUE))
story.append(Spacer(1, 10))
story.append(Paragraph("Безопасность и надёжность:", st_h3))
story.append(info_table(
    [
        ["SqlParameter", "Защита от SQL Injection — значения экранируются автоматически"],
        ["Try / Catch", "Если запрос к БД упал — показываем понятную ошибку, программа не падает"],
        ["IsActive = 0", "Пользователь деактивируется, а не удаляется (сохраняет связи в БД)"],
    ],
    ["Механизм", "Зачем"],
    [45*mm, 125*mm], GREEN))
story.append(PageBreak())

# ============================================================
# PARTICIPANT SECTIONS
# ============================================================
def participant(title, color, login, nav_steps, code_rows, says, highlight):
    flow = []
    flow.append(band(title, color))
    flow.append(Spacer(1, 6))
    flow.append(Paragraph("Вход: <b>%s</b>" % login, st_body))

    flow.append(Paragraph("Навигация в программе (что нажимать)", st_h3))
    flow.append(code_block(nav_steps))

    flow.append(Paragraph("Где в коде (какие файлы открывать)", st_h3))
    flow.append(info_table(code_rows, ["Файл / Метод", "Что показать"],
                           [70*mm, 100*mm], color))

    flow.append(Paragraph("Что говорить (на защите)", st_h3))
    for s in says:
        flow.append(say(s))

    flow.append(Spacer(1, 6))
    hl = Table([[Paragraph("Самое важное: " + highlight, st_cellb)]], colWidths=[170*mm])
    hl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHTB),
        ("BOX", (0,0), (-1,-1), 0.6, color),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    flow.append(hl)
    return flow

# ---- BEKZAT: ADMIN ----
story += participant(
    "BEKZAT — Admin", BLUE,
    "admin001 / Admin@123",
    [
        "Login (admin001) -> AdminDashboard",
        "  -> Manage Users",
        "       заполнить поля -> Add User",
        "       клик на юзера -> Update",
        "       клик на юзера -> Deactivate -> Yes",
        "  -> Sales Report  (показать таблицу)",
        "  -> Logout -> Yes",
    ],
    [
        ["User.cs", "Базовый класс — родитель всех ролей"],
        ["Admin.cs", "class Admin : User — наследование"],
        ["LoginForm.cs (стр. 73)", "switch(role) — выбор роли + static CurrentUser"],
        ["DBHelper.cs", "3 метода работы с БД + SqlParameter"],
        ["UserManagementForm.cs — BtnAdd_Click (165)", "Добавление юзера + проверка дубликата LoginID"],
        ["UserManagementForm.cs — ValidateInputs (253)", "Валидация email / phone / password"],
        ["UserManagementForm.cs — BtnDelete_Click (237)", "Deactivate (IsActive=0, не удаление)"],
    ],
    [
        "This is our base class User. Every role inherits from it, so we don't repeat the same properties four times.",
        "When the Admin adds a user, we first check if the Login ID already exists with SELECT COUNT, then validate every field before inserting.",
        "We don't delete users — we set IsActive = 0, because they may have related orders and transactions (foreign keys).",
    ],
    "switch(role) в LoginForm — показывает наследование + role-based access одной картинкой.")
story.append(PageBreak())

# ---- BEKZAT: CUSTOMER ----
story += participant(
    "BEKZAT — Customer", PURPLE,
    "cust001 / Cust@123",
    [
        "Login (cust001) -> CustomerDashboard",
        "  -> + Top Up -> RM 50 -> TOP UP WALLET -> Yes",
        "  -> Browse Menu & Order Food",
        "       Category: Lunch -> Nasi Campur -> Add to Cart -> 1 -> OK",
        "       Category: Drinks -> Teh Tarik -> Add to Cart -> 1 -> OK",
        "       CONFIRM ORDER -> Yes",
        "  -> My Orders  (показать статусы)",
        "  -> Send Feedback -> выбрать заказ -> текст -> рейтинг -> Submit",
        "  -> Logout -> Yes",
    ],
    [
        ["Customer.cs", "CanAfford / Deduct / Refund — бизнес-логика кошелька"],
        ["CustomerDashboard.cs (25-26)", "Кнопка Top Up + RefreshBalance()"],
        ["WalletTopUpForm.cs — BtnTopUp_Click (97)", "Валидация суммы (макс RM 500)"],
        ["MenuBrowseForm.cs — BtnPlaceOrder_Click (274)", "Оформление заказа — 4 шага по очереди (INSERT + UPDATE)"],
    ],
    [
        "Placing an order does four steps in order: create the order, add each item with a loop, take the money from the wallet, and save the payment record.",
        "I get the new order ID with SELECT SCOPE_IDENTITY(), then use it for the order items. A try/catch shows an error if anything goes wrong.",
        "Before top-up we validate: not empty, positive number, max RM 500 per transaction.",
    ],
    "MenuBrowseForm.cs — BtnPlaceOrder_Click: 4 шага заказа по очереди + цикл for по корзине.")
story.append(PageBreak())

# ---- MATZHAN: MANAGER ----
story += participant(
    "MATZHAN — Manager", ORANGE,
    "manager001 / Mgr@123",
    [
        "Login (manager001) -> ManagerDashboard",
        "  -> Customer Feedback",
        "       клик на строку -> написать ответ -> Submit Response",
        "  -> E-Wallet Report",
        "       показать Total (Top Up / Spend)",
        "       выбрать клиента -> Filter -> Clear",
        "  -> Logout -> Yes",
    ],
    [
        ["ManagerDashboard.cs (16-25)", "2 функции Manager: Feedback + Wallet Report"],
        ["FeedbackViewForm.cs — LoadFeedback (96)", "SQL JOIN Feedback+Users, ISNULL для пустого ответа"],
        ["FeedbackViewForm.cs — BtnRespond_Click (126)", "UPDATE ответа менеджера + GETDATE()"],
        ["WalletReportForm.cs — LoadReport (159)", "Фильтрация в C# циклом for + if (клиент/месяц/год)"],
        ["WalletReportForm.cs — LoadReport", "Подсчёт Total в том же цикле: Top Up vs Spend"],
    ],
    [
        "I load all feedback with a SQL JOIN between Feedback and Users so I can show the customer name next to the message.",
        "I use ISNULL here — if the manager hasn't replied yet, it shows '(No response yet)' instead of an empty cell.",
        "This report loads all transactions once, then filters them in C# with a for-loop and if-conditions for customer, month and year.",
    ],
    "WalletReportForm.cs — LoadReport: загрузка всех данных + фильтр циклом for с if.")
story.append(PageBreak())

# ---- ERBOLAT: CHEF ----
story += participant(
    "ERBOLAT — Chef", GREEN,
    "chef001 / Chef@123",
    [
        "Login (chef001) -> ChefDashboard",
        "  -> Menu Management",
        "       заполнить поля -> Add Item",
        "       клик на item -> изменить цену -> Update",
        "       клик на item -> Toggle Status",
        "  -> Order Management",
        "       клик на Pending заказ -> показать items внизу",
        "       Mark: In Progress -> Mark: Completed",
        "  -> Logout -> Yes",
    ],
    [
        ["ChefDashboard.cs (16-25)", "2 функции Chef: Menu + Order Management"],
        ["MenuManagementForm.cs — BtnAdd_Click (161)", "CREATE — INSERT нового блюда"],
        ["MenuManagementForm.cs — LoadMenu (135)", "READ — SELECT WHERE ChefID (только своё меню)"],
        ["MenuManagementForm.cs — BtnEdit_Click (183)", "UPDATE блюда"],
        ["MenuManagementForm.cs — BtnDelete_Click (208)", "DELETE блюда"],
        ["MenuManagementForm.cs — BtnToggle_Click (223)", "Тернарный оператор Available <-> Not Available"],
        ["OrderManagementForm.cs — UpdateStatus (162)", "Смена статуса + блокировка Completed/Cancelled"],
        ["OrderManagementForm.cs — LoadOrderItems (152)", "JOIN OrderItems + MenuItems"],
    ],
    [
        "This single form shows full CRUD: Add creates with INSERT, LoadMenu reads with SELECT, Edit updates, Delete deletes.",
        "The query filters WHERE ChefID — each chef only sees and manages their own menu items.",
        "When updating an order status there's a safety check — a Completed or Cancelled order can't be changed. Status only moves forward.",
    ],
    "MenuManagementForm.cs — полный CRUD (Create / Read / Update / Delete) в одном файле.")
story.append(PageBreak())

# ============================================================
# Q&A — OOP (общее для всех)
# ============================================================
story.append(Paragraph("6. Вопросы по ООП — должны знать все", st_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#D5DBDB"), spaceAfter=8))
oop = [
    ("What is inheritance? Give an example.",
     "Customer : User — Customer inherits all User properties (UserID, LoginID, FullName...) and adds its own: WalletBalance, Address, and methods CanAfford, Deduct, Refund."),
    ("What does <i>virtual</i> mean?",
     "It allows a child class to override the method. GetRoleDescription() is virtual in User and overridden in each child class."),
    ("What does <i>override</i> mean?",
     "The child class replaces the virtual method. Customer.GetRoleDescription() returns the wallet balance instead of the base text."),
    ("What is polymorphism? Is it used here?",
     "Yes. GetRoleDescription() is one method name with different behavior depending on the object (User vs Customer)."),
    ("What is encapsulation?",
     "Properties use { get; set; }. CurrentUser uses { get; private set; } — anyone can read it, only LoginForm can set it."),
    ("What is a static class?",
     "DBHelper, ThemeHelper, ValidationHelper — no need to create an object, called directly: DBHelper.ExecuteQuery(...)."),
    ("Why SqlParameter instead of string concatenation?",
     "Protection against SQL Injection. With concatenation, input like ' OR 1=1 -- could bypass the login."),
    ("How would you add a new role (e.g. Waiter)?",
     "Create class Waiter : User, add a case in the LoginForm switch, and a new dashboard form. Base class and DBHelper stay unchanged."),
]
for q, a in oop:
    story.append(qa(q, a))

story.append(PageBreak())

# ============================================================
# Q&A — per role
# ============================================================
story.append(Paragraph("7. Вопросы по ролям", st_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#D5DBDB"), spaceAfter=8))

story.append(band("Admin / Customer — Bekzat", BLUE)); story.append(Spacer(1,6))
for q,a in [
    ("What happens when Admin adds a Customer role?",
     "A Customers record is auto-created with WalletBalance = 0."),
    ("Why Deactivate instead of Delete?",
     "Set IsActive=0. Deleting would break foreign keys (orders, transactions linked to the user)."),
    ("How does the order placement work?",
     "Four steps in order: create the order (get its ID with SCOPE_IDENTITY), add each item with a loop, deduct the wallet, save the payment. A try/catch handles errors."),
    ("How does the system check if a customer can afford an order?",
     "Customer.CanAfford(amount) => WalletBalance >= amount. If false, the order is blocked."),
    ("What is static User CurrentUser?",
     "One shared instance for the whole app — the logged-in user. Any form reads it via LoginForm.CurrentUser."),
]:
    story.append(qa(q,a))

story.append(Spacer(1,10))
story.append(band("Manager — Matzhan", ORANGE)); story.append(Spacer(1,6))
for q,a in [
    ("What can the Manager do?",
     "Customer Feedback (read + respond) and E-Wallet Report (monitor transactions)."),
    ("What does ISNULL(ManagerResponse,'(No response yet)') do?",
     "If the manager hasn't replied, the value is NULL in the DB. ISNULL shows readable text instead of an empty cell."),
    ("How does the report filtering work?",
     "Load all transactions once, then loop through them in C#. if-conditions skip rows that don't match the selected customer, month or year."),
    ("What does the Total line show?",
     "Loops through rows: TopUp summed into one total, everything else into 'spend'. Shows Top Up vs Spend."),
    ("Why can't the Manager place orders or manage menu?",
     "Role-based access. ManagerDashboard only contains manager features — principle of least privilege."),
]:
    story.append(qa(q,a))

story.append(Spacer(1,10))
story.append(band("Chef — Erbolat", GREEN)); story.append(Spacer(1,6))
for q,a in [
    ("What CRUD operations are in Menu Management?",
     "Create (BtnAdd/INSERT), Read (LoadMenu/SELECT), Update (BtnEdit/UPDATE), Delete (BtnDelete/DELETE)."),
    ("Why does LoadMenu filter by ChefID?",
     "WHERE ChefID = @ChefID — each chef manages only their own dishes; menus stay separate."),
    ("What does Toggle Status do?",
     "Ternary: if 'Available' -> 'Not Available' and vice versa. The dish then appears/disappears in the customer menu."),
    ("Can a Chef move a Completed order back to Pending?",
     "No. UpdateStatus blocks Completed/Cancelled. Status only moves forward: Pending -> In Progress -> Completed."),
    ("What categories exist in Menu Management?",
     "Breakfast, Lunch, Dinner, Snacks, Drinks — fixed in cmbCategory per the assignment brief."),
]:
    story.append(qa(q,a))

# ---------- Footer / page numbers ----------
def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Body", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(20*mm, 12*mm, "Gr8Food Management System — Presentation Guide")
    canvas.drawRightString(190*mm, 12*mm, "стр. %d" % doc.page)
    canvas.setStrokeColor(colors.HexColor("#D5DBDB"))
    canvas.line(20*mm, 15*mm, 190*mm, 15*mm)
    canvas.restoreState()

def cover_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(BLUE)
    canvas.rect(0, A4[1]-12*mm, A4[0], 12*mm, fill=1, stroke=0)
    canvas.rect(0, 0, A4[0], 12*mm, fill=1, stroke=0)
    canvas.restoreState()

doc = SimpleDocTemplate(
    "C:/projectwithalibi/Gr8Food_Presentation_Guide.pdf",
    pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
    topMargin=18*mm, bottomMargin=20*mm,
    title="Gr8Food Presentation Guide", author="Team Gr8Food")

doc.build(story, onFirstPage=cover_bg, onLaterPages=footer)
print("PDF created OK")
