const currentUserData = localStorage.getItem("currentUser");
let currentUser;

if (!currentUserData) {
  window.location.replace("../loginpage/login.html");
} else {
  try {
    currentUser = JSON.parse(currentUserData);
  } catch (error) {
    console.error("Could not read the saved user session.", error);
    localStorage.removeItem("currentUser");
    window.location.replace("../loginpage/login.html");
  }

  if (currentUser && typeof currentUser === "object") {
    const displayName = typeof currentUser.name === "string" && currentUser.name.trim()
      ? currentUser.name.trim()
      : "Reader";

    document.getElementById("welcomeName").textContent = displayName;
    document.getElementById("profileName").textContent = displayName;
    document.getElementById("profileEmail").textContent =
      typeof currentUser.email === "string" ? currentUser.email : "Not provided";

    let books = [];
    const storedBooks = localStorage.getItem("libraryBooks");

    if (storedBooks) {
      try {
        const parsedBooks = JSON.parse(storedBooks);
        if (Array.isArray(parsedBooks)) {
          books = parsedBooks;
        } else {
          console.error("Saved book records are not a list.");
        }
      } catch (error) {
        console.error("Could not read the saved book records.", error);
      }
    }

    const validBooks = books.filter(function (book) {
      return book && Number.isInteger(book.quantity) && book.quantity >= 0;
    });
    const totalCopies = validBooks.reduce(function (total, book) {
      return total + book.quantity;
    }, 0);

    document.getElementById("bookCount").textContent = String(validBooks.length);
    document.getElementById("copyCount").textContent = String(totalCopies);

    let members = [];
    const storedMembers = localStorage.getItem("libraryMembers");
    if (storedMembers) {
      try {
        const parsedMembers = JSON.parse(storedMembers);
        if (Array.isArray(parsedMembers)) {
          members = parsedMembers;
        } else {
          console.error("Saved member records are not a list.");
        }
      } catch (error) {
        console.error("Could not read the saved member records.", error);
      }
    }
    document.getElementById("memberCount").textContent = String(members.length);

    let issues = [];
    const storedIssues = localStorage.getItem("libraryIssues");
    if (storedIssues) {
      try {
        const parsedIssues = JSON.parse(storedIssues);
        if (Array.isArray(parsedIssues)) {
          issues = parsedIssues;
        } else {
          console.error("Saved issue records are not a list.");
        }
      } catch (error) {
        console.error("Could not read the saved issue records.", error);
      }
    }

    const activeIssueCount = issues.filter(function (issue) {
      return issue && issue.status === "issued";
    }).length;
    document.getElementById("issuedCount").textContent = String(activeIssueCount);

  }
}

document.getElementById("logoutButton").addEventListener("click", function () {
  localStorage.removeItem("currentUser");
  window.location.replace("../loginpage/login.html");
});

const menuToggle = document.getElementById("menuToggle");
const mainNavigation = document.getElementById("mainNavigation");

function setNavigationOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  mainNavigation.classList.toggle("is-open", isOpen);
}

menuToggle.addEventListener("click", function () {
  setNavigationOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

mainNavigation.addEventListener("click", function (event) {
  if (event.target.closest("a")) {
    setNavigationOpen(false);
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    setNavigationOpen(false);
    menuToggle.focus();
  }
});

window.addEventListener("resize", function () {
  if (window.innerWidth > 760) {
    setNavigationOpen(false);
  }
});

document.getElementById("deleteAccountButton").addEventListener("click", function () {
  const accountStatus = document.getElementById("accountStatus");
  const email = currentUser && typeof currentUser.email === "string"
    ? currentUser.email.trim().toLowerCase()
    : "";

  accountStatus.textContent = "";
  if (!email) {
    accountStatus.textContent = "This account cannot be deleted because its email address is unavailable.";
    return;
  }

  if (!window.confirm("Delete your Digital Library account? This cannot be undone. Your library records will remain in this browser.")) {
    return;
  }

  try {
    const savedUsers = localStorage.getItem("libraryUsers");
    const savedLegacyUser = localStorage.getItem("libraryUser");
    let users = [];
    let legacyUsers = null;
    let legacyUsersWasArray = false;

    if (savedUsers) {
      users = JSON.parse(savedUsers);
      if (!Array.isArray(users)) {
        throw new Error("Saved user records are not a list.");
      }
    }

    if (savedLegacyUser) {
      legacyUsers = JSON.parse(savedLegacyUser);
      if (Array.isArray(legacyUsers)) {
        legacyUsersWasArray = true;
      } else if (legacyUsers && typeof legacyUsers === "object") {
        legacyUsers = [legacyUsers];
      } else {
        throw new Error("Saved legacy account data has an invalid format.");
      }
    }

    const matchesCurrentAccount = function (user) {
      return user &&
        typeof user.email === "string" &&
        user.email.trim().toLowerCase() === email;
    };

    if (savedUsers) {
      localStorage.setItem("libraryUsers", JSON.stringify(users.filter(function (user) {
        return !matchesCurrentAccount(user);
      })));
    }

    if (savedLegacyUser) {
      const remainingLegacyUsers = legacyUsers.filter(function (user) {
        return !matchesCurrentAccount(user);
      });
      if (remainingLegacyUsers.length === 0) {
        localStorage.removeItem("libraryUser");
      } else {
        localStorage.setItem(
          "libraryUser",
          JSON.stringify(legacyUsersWasArray ? remainingLegacyUsers : remainingLegacyUsers[0])
        );
      }
    }

    localStorage.removeItem("currentUser");
    window.location.replace("../loginpage/login.html");
  } catch (error) {
    console.error("Could not delete the account from local storage.", error);
    accountStatus.textContent = "Account deletion failed. Your saved account data could not be updated.";
  }
});
