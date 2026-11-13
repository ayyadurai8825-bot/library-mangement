const bookForm = document.getElementById("bookForm");
const bookRows = document.getElementById("bookRows");
const bookCount = document.getElementById("bookCount");
const emptyState = document.getElementById("emptyState");
const formMessage = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");
const cancelButton = document.getElementById("cancelButton");
const bookSearch = document.getElementById("bookSearch");
const clearSearchButton = document.getElementById("clearSearchButton");
const bookDialog = document.getElementById("bookDialog");
const pageMessage = document.getElementById("pageMessage");

let books = [];
let editingBookId = null;
let storageAvailable = true;

const currentUserData = localStorage.getItem("currentUser");
if (!currentUserData) {
  window.location.replace("../loginpage/login.html");
} else {
  try {
    JSON.parse(currentUserData);
  } catch (error) {
    console.error("Could not read the saved user session.", error);
    localStorage.removeItem("currentUser");
    window.location.replace("../loginpage/login.html");
  }
}

try {
  const savedBooks = localStorage.getItem("libraryBooks");
  if (savedBooks) {
    const parsedBooks = JSON.parse(savedBooks);
    if (!Array.isArray(parsedBooks)) {
      throw new Error("Saved book records are not a list.");
    }
    const recordsAreValid = parsedBooks.every(function (book) {
      return book &&
        typeof book.bookId === "string" &&
        typeof book.title === "string" &&
        typeof book.author === "string" &&
        typeof book.category === "string" &&
        Number.isInteger(book.quantity) &&
        book.quantity >= 0;
    });
    if (!recordsAreValid) {
      throw new Error("Saved book records contain invalid data.");
    }
    books = parsedBooks;
  }
} catch (error) {
  console.error("Could not load book records from local storage.", error);
  showMessage("Book records could not be loaded. Check browser storage and reload.", false);
  storageAvailable = false;
  saveButton.disabled = true;
}

function showMessage(message, isSuccess) {
  formMessage.textContent = message;
  formMessage.classList.toggle("success", isSuccess);
  pageMessage.textContent = message;
  pageMessage.classList.toggle("success", isSuccess);
}

function renderBooks() {
  const searchTerm = bookSearch.value.trim().toLowerCase();
  const filteredBooks = books.filter(function (book) {
    return [book.title, book.author, book.category].some(function (value) {
      return value.toLowerCase().includes(searchTerm);
    });
  });

  const rows = filteredBooks.map(function (book) {
    const row = document.createElement("tr");

    [book.bookId, book.title, book.author, book.category, String(book.quantity)].forEach(function (value) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "action-button edit-button";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", `Edit ${book.title}`);
    editButton.addEventListener("click", function () {
      startEditing(book.bookId);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "action-button delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${book.title}`);
    deleteButton.addEventListener("click", function () {
      deleteBook(book.bookId);
    });

    actions.append(editButton, deleteButton);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    return row;
  });

  bookRows.replaceChildren(...rows);
  const totalLabel = `${books.length} ${books.length === 1 ? "book" : "books"}`;
  bookCount.textContent = searchTerm
    ? `${filteredBooks.length} of ${totalLabel}`
    : totalLabel;
  emptyState.hidden = filteredBooks.length > 0;
  emptyState.textContent = books.length === 0
    ? "No books added yet."
    : "No books match your search.";
  clearSearchButton.hidden = searchTerm.length === 0;
}

function persistBooks(updatedBooks) {
  try {
    localStorage.setItem("libraryBooks", JSON.stringify(updatedBooks));
    books = updatedBooks;
    renderBooks();
    return true;
  } catch (error) {
    console.error("Could not save book records to local storage.", error);
    showMessage("Unable to save books. Check browser storage and try again.", false);
    return false;
  }
}

function getActiveIssueCount(bookId) {
  const savedIssues = localStorage.getItem("libraryIssues");
  if (!savedIssues) {
    return 0;
  }

  const parsedIssues = JSON.parse(savedIssues);
  if (!Array.isArray(parsedIssues)) {
    throw new Error("Saved issue history is not a list.");
  }

  return parsedIssues.filter(function (issue) {
    return issue && issue.bookId === bookId && issue.status === "issued";
  }).length;
}

function startEditing(bookId) {
  const book = books.find(function (item) {
    return item.bookId === bookId;
  });

  if (!book) {
    showMessage("That book record could not be found.", false);
    return;
  }

  document.getElementById("bookId").value = book.bookId;
  document.getElementById("title").value = book.title;
  document.getElementById("author").value = book.author;
  document.getElementById("category").value = book.category;
  document.getElementById("quantity").value = book.quantity;
  editingBookId = bookId;
  document.getElementById("formTitle").textContent = "Edit a book";
  saveButton.textContent = "Save Changes";
  cancelButton.hidden = false;
  pageMessage.textContent = "";
  showMessage("", false);
  bookDialog.showModal();
  document.getElementById("bookId").focus();
}

function resetForm() {
  bookForm.reset();
  editingBookId = null;
  document.getElementById("formTitle").textContent = "Add a book";
  saveButton.textContent = "Add Book";
  cancelButton.hidden = true;
}

function openAddDialog() {
  resetForm();
  showMessage("", false);
  pageMessage.textContent = "";
  bookDialog.showModal();
  document.getElementById("bookId").focus();
}

function deleteBook(bookId) {
  const bookIndex = books.findIndex(function (item) {
    return item.bookId === bookId;
  });

  if (bookIndex === -1) {
    showMessage("That book record could not be found.", false);
    return;
  }

  try {
    if (getActiveIssueCount(bookId) > 0) {
      showMessage("This book has active loans and cannot be deleted until it is returned.", false);
      return;
    }
  } catch (error) {
    console.error("Could not verify active loans before deleting the book.", error);
    showMessage("Could not verify issue history. The book was not deleted.", false);
    return;
  }

  const updatedBooks = books.slice();
  updatedBooks.splice(bookIndex, 1);
  if (persistBooks(updatedBooks)) {
    if (editingBookId === bookId) {
      resetForm();
    }
    showMessage("Book deleted.", true);
  }
}

bookForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (!storageAvailable) {
    showMessage("Book management is unavailable because saved records could not be loaded.", false);
    return;
  }

  const bookId = document.getElementById("bookId").value.trim();
  const title = document.getElementById("title").value.trim();
  const author = document.getElementById("author").value.trim();
  const category = document.getElementById("category").value.trim();
  const quantityValue = document.getElementById("quantity").value;
  const quantity = Number(quantityValue);

  if (!bookId || !title || !author || !category) {
    showMessage("Complete all book fields.", false);
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 0 || quantityValue === "") {
    showMessage("Quantity must be a whole number of zero or more.", false);
    return;
  }

  const duplicateId = books.some(function (book) {
    return book.bookId.toLowerCase() === bookId.toLowerCase() &&
      book.bookId !== editingBookId;
  });

  if (duplicateId) {
    showMessage("That Book ID is already in use.", false);
    return;
  }

  let updatedBooks;

  const wasEditing = editingBookId !== null;

  if (wasEditing) {
    const bookIndex = books.findIndex(function (book) {
      return book.bookId === editingBookId;
    });

    if (bookIndex === -1) {
      showMessage("The book being edited could not be found.", false);
      resetForm();
      return;
    }

    try {
      if (bookId !== editingBookId && getActiveIssueCount(editingBookId) > 0) {
        showMessage("The Book ID cannot be changed while this book has active loans.", false);
        return;
      }
    } catch (error) {
      console.error("Could not verify active loans before updating the book.", error);
      showMessage("Could not verify issue history. The book was not updated.", false);
      return;
    }

    const updatedBook = Object.assign({}, books[bookIndex], {
      bookId,
      title,
      author,
      category,
      quantity,
      updatedAt: new Date().toISOString()
    });
    updatedBooks = books.slice();
    updatedBooks.splice(bookIndex, 1, updatedBook);
  } else {
    const updatedBook = {
      bookId,
      title,
      author,
      category,
      quantity,
      createdAt: new Date().toISOString()
    };
    updatedBooks = books.slice();
    updatedBooks.push(updatedBook);
  }

  if (persistBooks(updatedBooks)) {
    resetForm();
    bookDialog.close();
    showMessage(wasEditing ? "Book updated." : "Book saved.", true);
  }
});

cancelButton.addEventListener("click", function () {
  resetForm();
  showMessage("", false);
  bookDialog.close();
});

document.getElementById("addBookButton").addEventListener("click", openAddDialog);
document.getElementById("closeDialogButton").addEventListener("click", function () {
  bookDialog.close();
});

bookDialog.addEventListener("click", function (event) {
  if (event.target === bookDialog) {
    bookDialog.close();
  }
});

bookDialog.addEventListener("close", function () {
  if (editingBookId !== null) {
    resetForm();
  }
});

bookSearch.addEventListener("input", renderBooks);

clearSearchButton.addEventListener("click", function () {
  bookSearch.value = "";
  renderBooks();
  bookSearch.focus();
});

document.getElementById("logoutButton").addEventListener("click", function () {
  localStorage.removeItem("currentUser");
  window.location.replace("../loginpage/login.html");
});

renderBooks();
