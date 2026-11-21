// The report page reads the same browser storage records as the library pages.
const reportFields = {
  totalBooks: document.getElementById("totalBooks"),
  totalMembers: document.getElementById("totalMembers"),
  issuedBooks: document.getElementById("issuedBooks"),
  returnedBooks: document.getElementById("returnedBooks"),
  availableBooks: document.getElementById("availableBooks"),
  overdueBooks: document.getElementById("overdueBooks"),
  totalFineCollected: document.getElementById("totalFineCollected")
};

const reportStatus = document.getElementById("reportStatus");
const updatedAt = document.getElementById("updatedAt");
const reportSearch = document.getElementById("reportSearch");
const searchableItems = Array.from(document.querySelectorAll(".searchable"));
const categoryNames = ["Programming", "Science", "History", "Literature", "Database", "Web Development"];
const recentWindowMs = 10 * 60 * 1000;

let currentBooks = [];
let currentMembers = [];
let currentIssues = [];

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getToday() {
  return localDateString(new Date());
}

function parseDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";
}

// Calculate fine as ₹5 for each day after the due date.
function calculateFine(issue) {
  if (!issue.dueDate) {
    return { overdueDays: 0, fineAmount: 0 };
  }

  const due = parseDate(issue.dueDate);
  const endValue = issue.status === "returned" && issue.returnDate
    ? issue.returnDate
    : getToday();
  const end = parseDate(endValue);

  if (!due || !end || end <= due) {
    return { overdueDays: 0, fineAmount: 0 };
  }

  // Use date-only UTC values so time and daylight-saving changes do not affect overdue days.
  const dueTime = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const endTime = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const overdueDays = Math.floor((endTime - dueTime) / 86400000);

  return {
    overdueDays: overdueDays,
    fineAmount: overdueDays * 5
  };
}

// Returned records use the saved fine details; older records are calculated on the report.
function getFineDetails(issue) {
  if (issue.status === "returned" &&
      Number.isInteger(issue.overdueDays) &&
      Number.isInteger(issue.fineAmount)) {
    return {
      overdueDays: issue.overdueDays,
      fineAmount: issue.fineAmount
    };
  }
  return calculateFine(issue);
}

function readArray(key, validate, label) {
  const savedValue = localStorage.getItem(key);
  if (savedValue === null) {
    return [];
  }

  const records = JSON.parse(savedValue);
  if (!Array.isArray(records) || !records.every(validate)) {
    throw new Error(`Saved ${label} records contain invalid data.`);
  }
  return records;
}

function readMembers() {
  if (localStorage.getItem("libraryMembers") !== null) {
    return readArray("libraryMembers", function (member) {
      return member &&
        typeof member.memberId === "string" &&
        typeof member.name === "string" &&
        typeof member.email === "string";
    }, "member");
  }

  // Support accounts created before the separate member list was introduced.
  return readArray("libraryUsers", function (user) {
    return user && typeof user.name === "string" && typeof user.email === "string";
  }, "registered user").map(function (user, index) {
    return {
      memberId: `M${String(index + 1).padStart(3, "0")}`,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt || user.registeredAt || user.registrationDate
    };
  });
}

function isValidBook(book) {
  return book &&
    typeof book.bookId === "string" &&
    typeof book.title === "string" &&
    typeof book.author === "string" &&
    typeof book.category === "string" &&
    Number.isInteger(book.quantity) &&
    book.quantity >= 0;
}

function isValidIssue(issue) {
  return issue &&
    typeof issue.issueId === "string" &&
    typeof issue.bookId === "string" &&
    (issue.status === "issued" || issue.status === "returned") &&
    typeof issue.issueDate === "string" &&
    (issue.returnDate === null || typeof issue.returnDate === "string");
}

function getIssueCreatedAt(issue) {
  const savedDate = parseDate(issue.createdAt);
  if (savedDate) {
    return savedDate;
  }

  // Older issue records embed their creation timestamp in the issue ID.
  const idTimestamp = typeof issue.issueId === "string"
    ? issue.issueId.match(/^ISS-(\d{13})-/)
    : null;
  return idTimestamp ? new Date(Number(idTimestamp[1])) : null;
}

function isWithinRecentWindow(value) {
  const date = value instanceof Date ? value : parseDate(value);
  const age = date ? Date.now() - date.getTime() : -1;
  return age >= 0 && age <= recentWindowMs;
}

function getIssueRecentAt(issue) {
  if (issue.status === "returned") {
    const returnedAt = parseDate(issue.returnedAt);
    if (returnedAt && isWithinRecentWindow(returnedAt)) {
      return returnedAt;
    }
  }
  return getIssueCreatedAt(issue);
}

function getRecentIssues(issues) {
  return issues.filter(function (issue) {
    return isWithinRecentWindow(getIssueRecentAt(issue));
  }).sort(function (first, second) {
    return getIssueRecentAt(second) - getIssueRecentAt(first);
  });
}

function dateFromRecord(record, fields) {
  for (const field of fields) {
    if (parseDate(record[field])) {
      return record[field];
    }
  }
  return null;
}

function getRecentActivities(books, members, issues) {
  const activities = [];
  const bookCreatedFields = ["createdAt", "addedAt", "dateAdded", "createdDate"];
  const memberCreatedFields = [
    "createdAt", "registeredAt", "registrationDate", "dateAdded", "joinDate", "createdDate"
  ];
  const updatedFields = ["updatedAt", "modifiedAt", "lastUpdated"];

  function addActivity(title, detail, value, icon) {
    const date = parseDate(value);
    if (date && isWithinRecentWindow(date)) {
      activities.push({ title: title, detail: detail, date: date, icon: icon });
    }
  }

  books.forEach(function (book) {
    addActivity("New book added", book.title, dateFromRecord(book, bookCreatedFields), "📚");
    addActivity("Book updated", book.title, dateFromRecord(book, updatedFields), "✏️");
  });

  members.forEach(function (member) {
    addActivity("Member registered", member.name, dateFromRecord(member, memberCreatedFields), "👤");
    addActivity("Member updated", member.name, dateFromRecord(member, updatedFields), "✏️");
  });

  issues.forEach(function (issue) {
    addActivity(
      "Book issued",
      `${issue.bookTitle || issue.bookId} to ${issue.memberName || "a member"}`,
      getIssueCreatedAt(issue),
      "📤"
    );
    if (issue.status === "returned") {
      addActivity(
        "Book returned",
        `${issue.bookTitle || issue.bookId} by ${issue.memberName || "a member"}`,
        issue.returnedAt,
        "📥"
      );
    }
  });

  return activities.sort(function (first, second) {
    return second.date.getTime() - first.date.getTime();
  });
}

function renderChart(chartId, records, dateField, color, emptyMessage) {
  const chart = document.getElementById(chartId);
  const empty = chart.parentElement.querySelector(".chart-empty");
  const months = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      label: month.toLocaleDateString(undefined, { month: "short" })
    });
  }

  const counts = months.map(function (month) {
    return records.filter(function (record) {
      const date = parseDate(record[dateField]);
      return date &&
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === month.key;
    }).length;
  });
  const peak = Math.max(1, ...counts);
  const hasData = counts.some(function (count) {
    return count > 0;
  });

  chart.replaceChildren();
  chart.style.setProperty("--bar-color", color);
  chart.hidden = !hasData;
  empty.hidden = hasData;
  empty.textContent = emptyMessage;

  if (!hasData) {
    return;
  }

  months.forEach(function (month, index) {
    const column = document.createElement("div");
    column.className = "chart-column";

    const value = document.createElement("span");
    value.className = "chart-value";
    value.textContent = String(counts[index]);

    const bar = document.createElement("span");
    bar.className = "chart-bar";
    bar.style.height = `${Math.max(3, (counts[index] / peak) * 75)}%`;
    bar.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = month.label;

    column.append(value, bar, label);
    chart.appendChild(column);
  });
}

function renderCategories(books, issues) {
  const totals = new Map(categoryNames.map(function (name) {
    return [name, 0];
  }));
  const additionalCategories = new Map();
  const categoriesByBookId = new Map();

  books.forEach(function (book) {
    const name = book.category.trim();
    const normalized = name.toLowerCase();
    const matchedCategory = categoryNames.find(function (category) {
      return category.toLowerCase() === normalized;
    });

    categoriesByBookId.set(book.bookId, matchedCategory || name);
    if (matchedCategory) {
      totals.set(matchedCategory, totals.get(matchedCategory) + book.quantity);
    } else if (name) {
      additionalCategories.set(name, (additionalCategories.get(name) || 0) + book.quantity);
    }
  });

  issues.forEach(function (issue) {
    if (issue.status !== "issued") {
      return;
    }
    const category = categoriesByBookId.get(issue.bookId);
    if (totals.has(category)) {
      totals.set(category, totals.get(category) + 1);
    } else if (category) {
      additionalCategories.set(category, (additionalCategories.get(category) || 0) + 1);
    }
  });

  const categories = Array.from(totals, function (entry) {
    return { name: entry[0], count: entry[1] };
  });
  additionalCategories.forEach(function (count, name) {
    categories.push({ name: name, count: count });
  });

  const maxCount = Math.max(1, ...categories.map(function (category) {
    return category.count;
  }));
  const list = document.getElementById("categoryList");
  list.replaceChildren();

  categories.forEach(function (category) {
    const item = document.createElement("div");
    item.className = "category-item";

    const meta = document.createElement("div");
    meta.className = "category-meta";
    const name = document.createElement("span");
    name.textContent = category.name;
    const count = document.createElement("strong");
    count.textContent = String(category.count);
    meta.append(name, count);

    const track = document.createElement("div");
    track.className = "progress-track";
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${category.name}: ${category.count} copies`);
    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = category.count ? `${(category.count / maxCount) * 100}%` : "0%";
    track.appendChild(fill);

    item.append(meta, track);
    list.appendChild(item);
  });
}

function renderPopularBooks(issues) {
  const counts = new Map();
  issues.forEach(function (issue) {
    const key = issue.bookId || issue.bookTitle;
    const entry = counts.get(key) || { title: issue.bookTitle || issue.bookId, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  });

  const popular = Array.from(counts.values()).sort(function (first, second) {
    return second.count - first.count || first.title.localeCompare(second.title);
  }).slice(0, 5);
  const list = document.getElementById("popularList");
  list.replaceChildren();
  document.getElementById("popularEmpty").hidden = popular.length > 0;

  popular.forEach(function (book, index) {
    const item = document.createElement("li");
    item.className = "popular-item";

    const rank = document.createElement("span");
    rank.className = "rank-number";
    rank.textContent = String(index + 1).padStart(2, "0");

    const info = document.createElement("div");
    info.className = "popular-info";
    const title = document.createElement("strong");
    title.textContent = book.title;
    const subtitle = document.createElement("span");
    subtitle.textContent = "Most borrowed";
    info.append(title, subtitle);

    const count = document.createElement("span");
    count.className = "borrow-count";
    count.textContent = `${book.count} ${book.count === 1 ? "loan" : "loans"}`;
    item.append(rank, info, count);
    list.appendChild(item);
  });
}

function booksForTransaction(issue) {
  return currentBooks.find(function (book) {
    return book.bookId === issue.bookId;
  }) || { title: "" };
}

function transactionStatus(issue) {
  if (issue.status === "issued" && typeof issue.dueDate === "string" && issue.dueDate < getToday()) {
    return "Overdue";
  }
  return issue.status === "issued" ? "Issued" : "Returned";
}

function showTransactionDetails(issue, opener) {
  const book = booksForTransaction(issue);
  const createdAt = getIssueRecentAt(issue);
  const values = {
    detailBookId: issue.bookId || "—",
    detailBookName: issue.bookTitle || book.title || "—",
    detailMemberName: issue.memberName || "—",
    detailCreatedAt: createdAt ? createdAt.toLocaleString() : "—",
    detailIssueDate: dateLabel(issue.issueDate),
    detailDueDate: dateLabel(issue.dueDate),
    detailReturnDate: dateLabel(issue.returnDate),
    detailOverdueDays: issue.status === "returned" ? String(getFineDetails(issue).overdueDays) : "0",
    detailFineAmount: issue.status === "returned" ? `₹${getFineDetails(issue).fineAmount}` : "₹0",
    detailStatus: transactionStatus(issue)
  };

  Object.keys(values).forEach(function (id) {
    document.getElementById(id).textContent = values[id];
  });
  const status = document.getElementById("detailStatus");
  status.className = `detail-status${values.detailStatus === "Overdue" ? " overdue" : values.detailStatus === "Issued" ? " issued" : ""}`;

  const dialog = document.getElementById("transactionDialog");
  dialog.showModal();
  document.getElementById("closeTransactionDialog").focus();
  dialog.addEventListener("close", function restoreFocus() {
    dialog.removeEventListener("close", restoreFocus);
    if (opener.isConnected) {
      opener.focus();
    }
  });
}

function renderTransactions(issues) {
  const recent = getRecentIssues(issues);
  const rows = document.getElementById("transactionRows");
  const empty = document.getElementById("transactionEmpty");
  rows.replaceChildren();
  document.getElementById("transactionCount").textContent =
    `${recent.length} ${recent.length === 1 ? "record" : "records"}`;
  empty.hidden = recent.length > 0;
  empty.textContent = "No transactions added in the last 10 minutes.";

  recent.forEach(function (issue) {
    const row = document.createElement("tr");
    const book = booksForTransaction(issue);
    const bookName = issue.bookTitle || book.title || "Unknown book";
    const memberName = issue.memberName || "Unknown member";
    row.tabIndex = 0;
    row.setAttribute("aria-haspopup", "dialog");
    row.setAttribute("aria-label", `View transaction details: ${bookName}, ${memberName}`);
    row.addEventListener("click", function () {
      showTransactionDetails(issue, row);
    });
    row.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showTransactionDetails(issue, row);
      }
    });

    [
      issue.bookId,
      bookName,
      memberName,
      dateLabel(issue.dueDate),
      dateLabel(issue.returnDate),
      String(issue.status === "returned" ? getFineDetails(issue).overdueDays : 0),
      `₹${issue.status === "returned" ? getFineDetails(issue).fineAmount : 0}`
    ].forEach(function (value) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    const statusText = transactionStatus(issue);
    status.className = `status-pill${statusText === "Overdue" ? " overdue" : statusText === "Issued" ? " issued" : ""}`;
    status.textContent = statusText;
    statusCell.appendChild(status);
    row.appendChild(statusCell);
    rows.appendChild(row);
  });
}

function renderActivities(books, members, issues) {
  const activities = getRecentActivities(books, members, issues);
  const list = document.getElementById("activityList");
  const empty = document.getElementById("activityEmpty");
  list.replaceChildren();
  empty.hidden = activities.length > 0;
  empty.textContent = "No records added or updated in the last 10 minutes.";

  activities.forEach(function (activity) {
    const item = document.createElement("li");
    item.className = "activity-item";
    const marker = document.createElement("span");
    marker.className = "activity-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = activity.icon;

    const copy = document.createElement("div");
    copy.className = "activity-copy";
    const title = document.createElement("strong");
    title.textContent = activity.title;
    const detail = document.createElement("p");
    detail.textContent = activity.detail;
    const time = document.createElement("time");
    time.dateTime = activity.date.toISOString();
    time.textContent = activity.date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    copy.append(title, detail, time);
    item.append(marker, copy);
    list.appendChild(item);
  });
}

function updateSummary(books, members, issues) {
  const today = getToday();
  const activeMembers = members.filter(function (member) {
    return typeof member.status !== "string" || member.status.toLowerCase() !== "inactive";
  });
  const authors = new Set(books.map(function (book) {
    return book.author.trim().toLowerCase();
  }).filter(Boolean));
  const categories = new Set(books.map(function (book) {
    return book.category.trim().toLowerCase();
  }).filter(Boolean));

  document.getElementById("todayIssues").textContent = String(issues.filter(function (issue) {
    return issue.issueDate === today;
  }).length);
  document.getElementById("todayReturns").textContent = String(issues.filter(function (issue) {
    return issue.status === "returned" && issue.returnDate === today;
  }).length);
  document.getElementById("activeMembers").textContent = String(activeMembers.length);
  document.getElementById("totalAuthors").textContent = String(authors.size);
  document.getElementById("totalCategories").textContent = String(categories.size);
}

function filterReports() {
  const term = reportSearch.value.trim().toLowerCase();
  let visibleCount = 0;
  searchableItems.forEach(function (item) {
    const matches = item.textContent.toLowerCase().includes(term);
    item.hidden = !matches;
    if (matches) {
      visibleCount += 1;
    }
  });
  document.getElementById("searchEmpty").hidden = !term || visibleCount > 0;
}

function csvCell(value) {
  let text = String(value == null ? "" : value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const headers = ["Book ID", "Book Name", "Member Name", "Added At", "Due Date", "Return Date", "Overdue Days", "Fine Amount", "Status"];
  const rows = getRecentIssues(currentIssues).map(function (issue) {
    const createdAt = getIssueRecentAt(issue);
    const fine = getFineDetails(issue);
    return [
      issue.bookId,
      issue.bookTitle || booksForTransaction(issue).title,
      issue.memberName,
      createdAt ? createdAt.toISOString() : "",
      issue.dueDate || "",
      issue.returnDate || "",
      String(issue.status === "returned" ? fine.overdueDays : 0),
      String(issue.status === "returned" ? fine.fineAmount : 0),
      transactionStatus(issue)
    ];
  });
  const csv = [headers, ...rows].map(function (row) {
    return row.map(csvCell).join(",");
  }).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `library-report-${getToday()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
  reportStatus.textContent = "Transactions from the last 10 minutes exported as CSV.";
}

function showLoadError(error) {
  console.error("Could not calculate library reports.", error);
  currentBooks = [];
  currentMembers = [];
  currentIssues = [];
  Object.values(reportFields).forEach(function (field) {
    field.textContent = "—";
  });

  [
    "issuesChart", "returnsChart", "membersChart", "categoryList",
    "popularList", "transactionRows", "activityList"
  ].forEach(function (id) {
    const element = document.getElementById(id);
    element.replaceChildren();
    if (id.endsWith("Chart")) {
      element.hidden = true;
    }
  });
  ["issuesChart", "returnsChart", "membersChart"].forEach(function (id) {
    const chart = document.getElementById(id);
    chart.parentElement.querySelector(".chart-empty").hidden = false;
  });
  ["categoryEmpty", "popularEmpty", "transactionEmpty", "activityEmpty"].forEach(function (id) {
    document.getElementById(id).hidden = false;
  });
  document.getElementById("transactionCount").textContent = "0 records";
  ["todayIssues", "todayReturns", "activeMembers", "totalAuthors", "totalCategories"]
    .forEach(function (id) {
      document.getElementById(id).textContent = "—";
    });
  document.getElementById("noDataMessage").hidden = true;
  reportStatus.textContent = "Report data could not be loaded. Check local storage and refresh.";
  updatedAt.textContent = `Last checked: ${new Date().toLocaleString()}`;
}

function updateReports() {
  try {
    const books = readArray("libraryBooks", isValidBook, "book");
    const members = readMembers();
    const issues = readArray("libraryIssues", isValidIssue, "issue");

    currentBooks = books;
    currentMembers = members;
    currentIssues = issues;

    const issued = issues.filter(function (issue) {
      return issue.status === "issued";
    });
    const returned = issues.filter(function (issue) {
      return issue.status === "returned";
    });
    const overdue = issued.filter(function (issue) {
      return typeof issue.dueDate === "string" && issue.dueDate < getToday();
    });
    const availableCount = books.reduce(function (total, book) {
      return total + book.quantity;
    }, 0);
    const totalFineCollected = returned.reduce(function (total, issue) {
      return total + getFineDetails(issue).fineAmount;
    }, 0);

    reportFields.totalBooks.textContent = String(availableCount + issued.length);
    reportFields.totalMembers.textContent = String(members.length);
    reportFields.issuedBooks.textContent = String(issued.length);
    reportFields.returnedBooks.textContent = String(returned.length);
    reportFields.availableBooks.textContent = String(availableCount);
    reportFields.overdueBooks.textContent = String(overdue.length);
    reportFields.totalFineCollected.textContent = `₹${totalFineCollected}`;

    renderChart("issuesChart", issues, "issueDate", "#0f766e", "No Data Available");
    renderChart("returnsChart", returned, "returnDate", "#16966a", "No Data Available");
    const membersWithDates = members.map(function (member) {
      return Object.assign({}, member, {
        reportRegistrationDate: dateFromRecord(member, [
          "createdAt", "registeredAt", "registrationDate", "dateAdded", "joinDate", "createdDate"
        ])
      });
    }).filter(function (member) {
      return member.reportRegistrationDate;
    });
    renderChart(
      "membersChart",
      membersWithDates,
      "reportRegistrationDate",
      "#0e8f91",
      "No registration dates saved"
    );

    renderCategories(books, issues);
    renderPopularBooks(issues);
    renderTransactions(issues);
    renderActivities(books, members, issues);
    updateSummary(books, members, issues);

    document.getElementById("noDataMessage").hidden =
      books.length > 0 || members.length > 0 || issues.length > 0;
    document.getElementById("categoryEmpty").hidden = true;
    reportStatus.textContent = "";
    updatedAt.textContent = `Last updated: ${new Date().toLocaleString()}`;
    filterReports();
  } catch (error) {
    showLoadError(error);
  }
}

function verifySession() {
  try {
    const savedUser = localStorage.getItem("currentUser");
    if (!savedUser) {
      window.location.replace("../loginpage/login.html");
      return;
    }
    JSON.parse(savedUser);
  } catch (error) {
    console.error("Could not verify the saved user session.", error);
    reportStatus.textContent = "Could not verify your login. Please sign in again.";
    window.location.replace("../loginpage/login.html");
  }
}

document.getElementById("refreshButton").addEventListener("click", updateReports);
reportSearch.addEventListener("input", filterReports);
document.getElementById("logoutButton").addEventListener("click", function () {
  localStorage.removeItem("currentUser");
  window.location.replace("../loginpage/login.html");
});
document.getElementById("printButton").addEventListener("click", function () {
  window.print();
});
document.getElementById("pdfButton").addEventListener("click", function () {
  reportStatus.textContent = "In the print dialog, choose Save as PDF.";
  window.print();
});
document.getElementById("csvButton").addEventListener("click", exportCsv);

const transactionDialog = document.getElementById("transactionDialog");
document.getElementById("closeTransactionDialog").addEventListener("click", function () {
  transactionDialog.close();
});
transactionDialog.addEventListener("click", function (event) {
  if (event.target === transactionDialog) {
    transactionDialog.close();
  }
});

document.getElementById("currentYear").textContent = String(new Date().getFullYear());
window.addEventListener("storage", function (event) {
  if (event.key === null || ["libraryBooks", "libraryMembers", "libraryUsers", "libraryIssues"].includes(event.key)) {
    updateReports();
  }
});
window.addEventListener("pageshow", updateReports);
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) {
    updateReports();
  }
});
window.setInterval(function () {
  if (!document.hidden) {
    updateReports();
  }
}, 15000);

verifySession();
updateReports();