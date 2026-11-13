const issueForm = document.getElementById("issueForm");
const bookSelect = document.getElementById("bookSelect");
const memberSelect = document.getElementById("memberSelect");
const dueDateInput = document.getElementById("dueDate");
const issueRows = document.getElementById("issueRows");
const issueSearch = document.getElementById("issueSearch");
const emptyState = document.getElementById("emptyState");
const formMessage = document.getElementById("formMessage");
const issueButton = document.getElementById("issueButton");

let books = [];
let members = [];
let issues = [];
let dataAvailable = true;

function showMessage(message, isSuccess) {
  formMessage.textContent = message;
  formMessage.classList.toggle("success", isSuccess);
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadArray(key, validate, label) {
  const savedValue = localStorage.getItem(key);
  if (savedValue === null) {
    return [];
  }

  const parsedValue = JSON.parse(savedValue);
  if (!Array.isArray(parsedValue) || !parsedValue.every(validate)) {
    throw new Error(`Saved ${label} records contain invalid data.`);
  }
  return parsedValue;
}

function loadMembers() {
  const savedMembers = localStorage.getItem("libraryMembers");
  if (savedMembers !== null) {
    return loadArray("libraryMembers", function (member) {
      return member &&
        typeof member.memberId === "string" &&
        typeof member.name === "string" &&
        typeof member.email === "string";
    }, "member");
  }

  return loadArray("libraryUsers", function (user) {
    return user &&
      typeof user.name === "string" &&
      typeof user.email === "string";
  }, "registered user").map(function (user, index) {
    return {
      memberId: `M${String(index + 1).padStart(3, "0")}`,
      name: user.name,
      email: user.email,
      mobile: typeof user.phone === "string" ? user.phone : ""
    };
  });
}

function issueIsValid(issue) {
  return issue &&
    typeof issue.issueId === "string" &&
    typeof issue.bookId === "string" &&
    typeof issue.bookTitle === "string" &&
    typeof issue.memberId === "string" &&
    typeof issue.memberName === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(issue.issueDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(issue.dueDate) &&
    (issue.status === "issued" || issue.status === "returned") &&
    (issue.returnDate === null || typeof issue.returnDate === "string");
}

try {
  const currentUserData = localStorage.getItem("currentUser");
  if (!currentUserData) {
    window.location.replace("../loginpage/login.html");
  } else {
    JSON.parse(currentUserData);
  }

  books = loadArray("libraryBooks", function (book) {
    return book &&
      typeof book.bookId === "string" &&
      typeof book.title === "string" &&
      Number.isInteger(book.quantity) &&
      book.quantity >= 0;
  }, "book");
  members = loadMembers();
  issues = loadArray("libraryIssues", issueIsValid, "issue");
} catch (error) {
  console.error("Could not load issue management data.", error);
  showMessage("Library data could not be loaded. Check local storage and reload.", false);
  dataAvailable = false;
  issueButton.disabled = true;
}

function renderSelectOptions() {
  const availableBooks = books.filter(function (book) {
    return book.quantity > 0;
  });

  bookSelect.replaceChildren(new Option("Select an available book", ""));
  availableBooks.forEach(function (book) {
    bookSelect.add(new Option(`${book.title} (${book.quantity} available)`, book.bookId));
  });

  memberSelect.replaceChildren(new Option("Select a member", ""));
  members.forEach(function (member) {
    memberSelect.add(new Option(`${member.name} (${member.memberId})`, member.memberId));
  });

  if (availableBooks.length === 0) {
    bookSelect.options[0].textContent = "No books available";
  }
  if (members.length === 0) {
    memberSelect.options[0].textContent = "No members registered";
  }

  issueButton.disabled = !dataAvailable || availableBooks.length === 0 || members.length === 0;
}

function formatStatus(issue, today) {
  if (issue.status === "returned") {
    return { label: "Returned", className: "returned" };
  }
  if (issue.dueDate < today) {
    return { label: "Overdue", className: "overdue" };
  }
  return { label: "Issued", className: "" };
}

function renderHistory() {
  const today = localDateString(new Date());
  const searchTerm = issueSearch.value.trim().toLowerCase();
  const sortedIssues = issues.slice().reverse().filter(function (issue) {
    const status = formatStatus(issue, today);
    return [
      issue.bookTitle,
      issue.memberName,
      issue.memberId,
      issue.issueDate,
      issue.dueDate,
      issue.returnDate || "",
      status.label
    ].some(function (value) {
      return value.toLowerCase().includes(searchTerm);
    });
  });
  issueRows.replaceChildren();

  sortedIssues.forEach(function (issue) {
    const row = document.createElement("tr");
    const values = [
      issue.bookTitle,
      `${issue.memberName} (${issue.memberId})`,
      issue.issueDate,
      issue.dueDate,
      issue.returnDate || "—"
    ];

    values.forEach(function (value) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const status = formatStatus(issue, today);
    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = `status ${status.className}`.trim();
    statusBadge.textContent = status.label;
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    issueRows.appendChild(row);
  });

  const activeIssues = issues.filter(function (issue) {
    return issue.status === "issued";
  });
  const overdueIssues = activeIssues.filter(function (issue) {
    return issue.dueDate < today;
  });
  const availableCopies = books.reduce(function (total, book) {
    return total + book.quantity;
  }, 0);

  document.getElementById("activeLoanCount").textContent = String(activeIssues.length);
  document.getElementById("overdueLoanCount").textContent = String(overdueIssues.length);
  document.getElementById("availableCopyCount").textContent = String(availableCopies);
  document.getElementById("historyCount").textContent = searchTerm
    ? `${sortedIssues.length} of ${issues.length} records`
    : `${issues.length} ${issues.length === 1 ? "record" : "records"}`;
  emptyState.textContent = issues.length === 0
    ? "No issue records yet."
    : "No issue records match your search.";
  emptyState.hidden = sortedIssues.length > 0;
}

function persistLoanChanges(updatedBooks, updatedIssues) {
  let previousBooks = null;
  let previousIssues = null;
  let previousValuesRead = false;

  try {
    previousBooks = localStorage.getItem("libraryBooks");
    previousIssues = localStorage.getItem("libraryIssues");
    previousValuesRead = true;
    localStorage.setItem("libraryIssues", JSON.stringify(updatedIssues));
    localStorage.setItem("libraryBooks", JSON.stringify(updatedBooks));
    books = updatedBooks;
    issues = updatedIssues;
    renderSelectOptions();
    renderHistory();
    return true;
  } catch (error) {
    console.error("Could not save issue and book records.", error);
    try {
      if (!previousValuesRead) {
        throw new Error("Previous storage values were not available for rollback.");
      }
      if (previousIssues === null) {
        localStorage.removeItem("libraryIssues");
      } else {
        localStorage.setItem("libraryIssues", previousIssues);
      }
      if (previousBooks === null) {
        localStorage.removeItem("libraryBooks");
      } else {
        localStorage.setItem("libraryBooks", previousBooks);
      }
    } catch (rollbackError) {
      console.error("Could not restore library records after a failed save.", rollbackError);
    }
    showMessage("Could not save the borrowing change. Check browser storage and try again.", false);
    return false;
  }
}

issueForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (!dataAvailable) {
    showMessage("Borrowing is unavailable because library data could not be loaded.", false);
    return;
  }

  const book = books.find(function (item) {
    return item.bookId === bookSelect.value;
  });
  const member = members.find(function (item) {
    return item.memberId === memberSelect.value;
  });
  const dueDate = dueDateInput.value;
  const today = localDateString(new Date());

  if (!book || !member) {
    showMessage("Select a book and member.", false);
    return;
  }
  if (book.quantity < 1) {
    showMessage("No copies of this book are currently available.", false);
    renderSelectOptions();
    return;
  }
  if (!dueDate || dueDate < today) {
    showMessage("Choose a due date that is today or later.", false);
    return;
  }

  const updatedBooks = books.map(function (item) {
    return item.bookId === book.bookId
      ? Object.assign({}, item, { quantity: item.quantity - 1 })
      : item;
  });
  const newIssue = {
    issueId: `ISS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    bookId: book.bookId,
    bookTitle: book.title,
    memberId: member.memberId,
    memberName: member.name,
    issueDate: today,
    dueDate: dueDate,
    returnDate: null,
    status: "issued"
  };
  const updatedIssues = issues.concat(newIssue);

  if (persistLoanChanges(updatedBooks, updatedIssues)) {
    issueForm.reset();
    setDefaultDueDate();
    showMessage(`Issued "${book.title}" to ${member.name}.`, true);
  }
});

document.getElementById("logoutButton").addEventListener("click", function () {
  localStorage.removeItem("currentUser");
  window.location.replace("../loginpage/login.html");
});

issueSearch.addEventListener("input", renderHistory);

function setDefaultDueDate() {
  const today = localDateString(new Date());
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  dueDateInput.min = today;
  dueDateInput.value = localDateString(defaultDueDate);
}

setDefaultDueDate();
renderSelectOptions();
renderHistory();
