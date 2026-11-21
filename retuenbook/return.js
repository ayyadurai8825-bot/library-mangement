const loanRows = document.getElementById("loanRows");
const emptyState = document.getElementById("emptyState");
const pageMessage = document.getElementById("pageMessage");

let books = [];
let issues = [];
let dataAvailable = true;

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Calculate overdue days using midnight dates so DST does not affect the result.
function calculateFine(dueDate, returnDate) {
  const due = new Date(`${dueDate}T00:00:00Z`);
  const returned = new Date(`${returnDate}T00:00:00Z`);

  if (Number.isNaN(due.getTime()) || Number.isNaN(returned.getTime()) || returned <= due) {
    return { overdueDays: 0, fineAmount: 0 };
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const overdueDays = Math.floor((returned - due) / millisecondsPerDay);
  return {
    overdueDays: overdueDays,
    fineAmount: overdueDays * 5
  };
}

function showMessage(message, isSuccess) {
  pageMessage.textContent = message;
  pageMessage.classList.toggle("success", isSuccess);
}

function loadRecords(key, validate, label) {
  const storedValue = localStorage.getItem(key);
  if (storedValue === null) {
    return [];
  }

  const records = JSON.parse(storedValue);
  if (!Array.isArray(records) || !records.every(validate)) {
    throw new Error(`Saved ${label} records contain invalid data.`);
  }
  return records;
}

function isValidIssue(issue) {
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

  books = loadRecords("libraryBooks", function (book) {
    return book &&
      typeof book.bookId === "string" &&
      typeof book.title === "string" &&
      Number.isInteger(book.quantity) &&
      book.quantity >= 0;
  }, "book");
  issues = loadRecords("libraryIssues", isValidIssue, "issue");
} catch (error) {
  console.error("Could not load return-book data.", error);
  showMessage("Library data could not be loaded. Check local storage and reload.", false);
  dataAvailable = false;
}

function updateSummary(activeLoans, today) {
  const overdueLoans = activeLoans.filter(function (issue) {
    return issue.dueDate < today;
  });
  const returnedToday = issues.filter(function (issue) {
    return issue.status === "returned" && issue.returnDate === today;
  });

  document.getElementById("activeLoanCount").textContent = String(activeLoans.length);
  document.getElementById("overdueLoanCount").textContent = String(overdueLoans.length);
  document.getElementById("returnedTodayCount").textContent = String(returnedToday.length);
  document.getElementById("loanCount").textContent =
    `${activeLoans.length} ${activeLoans.length === 1 ? "loan" : "loans"}`;
}

function renderActiveLoans() {
  const today = localDateString(new Date());
  const activeLoans = issues.filter(function (issue) {
    return issue.status === "issued";
  }).reverse();

  loanRows.replaceChildren();

  activeLoans.forEach(function (issue) {
    const row = document.createElement("tr");
    const fields = [
      issue.bookTitle,
      `${issue.memberName} (${issue.memberId})`,
      issue.issueDate,
      issue.dueDate
    ];

    fields.forEach(function (value) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    // Show the fine preview for an active loan as of today.
    const finePreview = calculateFine(issue.dueDate, today);
    [finePreview.overdueDays, `₹${finePreview.fineAmount}`, "—"].forEach(function (value) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    });

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    const isOverdue = issue.dueDate < today;
    status.className = isOverdue ? "status overdue" : "status";
    status.textContent = isOverdue ? "Overdue" : "Issued";
    statusCell.appendChild(status);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    const returnButton = document.createElement("button");
    returnButton.type = "button";
    returnButton.className = "return-button";
    returnButton.textContent = "Return Book";
    returnButton.disabled = !dataAvailable;
    returnButton.setAttribute("aria-label", `Return ${issue.bookTitle}`);
    returnButton.addEventListener("click", function () {
      returnBook(issue.issueId);
    });
    actionCell.appendChild(returnButton);
    row.appendChild(actionCell);
    loanRows.appendChild(row);
  });

  updateSummary(activeLoans, today);
  emptyState.hidden = activeLoans.length > 0;
}

function persistReturn(updatedBooks, updatedIssues) {
  let previousBooks;
  let previousIssues;

  try {
    previousBooks = localStorage.getItem("libraryBooks");
    previousIssues = localStorage.getItem("libraryIssues");
    localStorage.setItem("libraryIssues", JSON.stringify(updatedIssues));
    localStorage.setItem("libraryBooks", JSON.stringify(updatedBooks));
    books = updatedBooks;
    issues = updatedIssues;
    renderActiveLoans();
    return true;
  } catch (error) {
    console.error("Could not save the book return.", error);
    try {
      if (previousIssues === null || previousIssues === undefined) {
        localStorage.removeItem("libraryIssues");
      } else {
        localStorage.setItem("libraryIssues", previousIssues);
      }
      if (previousBooks === null || previousBooks === undefined) {
        localStorage.removeItem("libraryBooks");
      } else {
        localStorage.setItem("libraryBooks", previousBooks);
      }
    } catch (rollbackError) {
      console.error("Could not restore library data after a failed return.", rollbackError);
    }
    showMessage("The return could not be saved. Check browser storage and try again.", false);
    return false;
  }
}

function returnBook(issueId) {
  if (!dataAvailable) {
    showMessage("Returning books is unavailable because library data could not be loaded.", false);
    return;
  }

  const issue = issues.find(function (item) {
    return item.issueId === issueId;
  });
  if (!issue || issue.status !== "issued") {
    showMessage("This loan is no longer active.", false);
    return;
  }

  const bookIndex = books.findIndex(function (book) {
    return book.bookId === issue.bookId;
  });
  if (bookIndex === -1) {
    showMessage("The matching book record was not found. The return was not recorded.", false);
    return;
  }

  const updatedBooks = books.slice();
  updatedBooks[bookIndex] = Object.assign({}, updatedBooks[bookIndex], {
    quantity: updatedBooks[bookIndex].quantity + 1
  });

  const today = localDateString(new Date());
  const fineDetails = calculateFine(issue.dueDate, today);
  const updatedIssues = issues.map(function (item) {
    return item.issueId === issueId
      ? Object.assign({}, item, {
        status: "returned",
        returnDate: today,
        returnedAt: new Date().toISOString(),
        overdueDays: fineDetails.overdueDays,
        fineAmount: fineDetails.fineAmount
      })
      : item;
  });

  if (persistReturn(updatedBooks, updatedIssues)) {
    showMessage(
      `"${issue.bookTitle}" returned successfully. Due: ${issue.dueDate}, Return: ${today}, Overdue days: ${fineDetails.overdueDays}, Fine: ₹${fineDetails.fineAmount}.`,
      true
    );
  }
}

document.getElementById("logoutButton").addEventListener("click", function () {
  localStorage.removeItem("currentUser");
  window.location.replace("../loginpage/login.html");
});

renderActiveLoans();
