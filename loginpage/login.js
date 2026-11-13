const loginForm = document.getElementById("loginForm");

if (loginForm) {
  const loginError = document.getElementById("loginError");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");

  function validateEmail(showRequired) {
    const email = emailInput.value.trim();
    if (!email) {
      emailError.textContent = showRequired ? "Email is required." : "";
      emailInput.setAttribute("aria-invalid", String(showRequired));
      return !showRequired;
    }

    const isValid = emailInput.validity.typeMismatch === false;
    emailError.textContent = isValid ? "" : "Enter a valid email address.";
    emailInput.setAttribute("aria-invalid", String(!isValid));
    return isValid;
  }

  function validatePassword(showRequired) {
    const isValid = passwordInput.value.length > 0;
    passwordError.textContent = isValid
      ? ""
      : showRequired ? "Password is required." : "";
    passwordInput.setAttribute("aria-invalid", String(showRequired && !isValid));
    return isValid;
  }

  function showLoginMessage(message, isSuccess) {
    loginError.textContent = message;
    loginError.classList.toggle("success", isSuccess);
    loginError.classList.toggle("error", Boolean(message) && !isSuccess);
  }

  function parseUsers(savedUsers, storageKey) {
    if (!savedUsers) {
      return [];
    }

    const parsedUsers = JSON.parse(savedUsers);
    if (Array.isArray(parsedUsers)) {
      return parsedUsers;
    }
    if (parsedUsers && typeof parsedUsers === "object") {
      return [parsedUsers];
    }
    throw new Error(`Saved account data in ${storageKey} has an invalid format.`);
  }

  function addUserAsMember(user) {
    const savedMembers = localStorage.getItem("libraryMembers");
    const members = savedMembers ? JSON.parse(savedMembers) : [];
    if (!Array.isArray(members) || !members.every(function (member) {
      return member &&
        typeof member.memberId === "string" &&
        typeof member.name === "string" &&
        typeof member.email === "string" &&
        typeof member.mobile === "string";
    })) {
      throw new Error("Saved member records have an invalid format.");
    }

    const email = user.email.trim().toLowerCase();
    const alreadyMember = members.some(function (member) {
      return member.email.trim().toLowerCase() === email;
    });
    if (alreadyMember) {
      return;
    }

    let memberNumber = 1;
    let memberId;
    do {
      memberId = `M${String(memberNumber).padStart(3, "0")}`;
      memberNumber += 1;
    } while (members.some(function (member) {
      return member.memberId.toLowerCase() === memberId.toLowerCase();
    }));

    members.push({
      memberId: memberId,
      name: typeof user.name === "string" && user.name.trim()
        ? user.name.trim()
        : email.split("@")[0],
      email: user.email.trim(),
      mobile: typeof user.phone === "string" ? user.phone : "",
      createdAt: user.createdAt || user.registeredAt || new Date().toISOString()
    });
    localStorage.setItem("libraryMembers", JSON.stringify(members));
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    emailError.textContent = "";
    passwordError.textContent = "";
    showLoginMessage("", false);

    emailInput.value = email;
    if (!validateEmail(true) || !validatePassword(true)) {
      return;
    }

    let users;
    try {
      users = parseUsers(localStorage.getItem("libraryUsers"), "libraryUsers");

      const legacyUserData = localStorage.getItem("libraryUser");
      if (legacyUserData) {
        const legacyUsers = parseUsers(legacyUserData, "libraryUser");
        legacyUsers.forEach(function (legacyUser) {
          if (legacyUser && typeof legacyUser.email === "string" &&
              !users.some(function (user) {
                return user && typeof user.email === "string" &&
                  user.email.trim().toLowerCase() === legacyUser.email.trim().toLowerCase();
              })) {
            users.push(legacyUser);
          }
        });
      }
    } catch (error) {
      console.error("Could not read registered users from local storage.", error);
      showLoginMessage("Unable to access accounts. Check browser storage and try again.", false);
      return;
    }

    const user = users.find(function (item) {
      return item &&
        typeof item.email === "string" &&
        item.email.trim().toLowerCase() === email &&
        typeof item.password === "string" &&
        item.password === password;
    });

    if (!user) {
      passwordError.textContent = "Email or password is incorrect.";
      passwordInput.setAttribute("aria-invalid", "true");
      return;
    }

    try {
      addUserAsMember(user);
      localStorage.setItem("currentUser", JSON.stringify(user));
    } catch (error) {
      console.error("Could not save the member record or login session.", error);
      showLoginMessage("Unable to save your member record or session. Check browser storage and try again.", false);
      return;
    }

    showLoginMessage("Login successful. Opening your dashboard...", true);

    setTimeout(function () {
      window.location.href = "../dashboard/index.html";
    }, 700);
  });

  emailInput.addEventListener("input", function () {
    validateEmail(true);
    if (passwordError.textContent === "Email or password is incorrect.") {
      passwordError.textContent = "";
      passwordInput.removeAttribute("aria-invalid");
    }
  });

  passwordInput.addEventListener("input", function () {
    validatePassword(true);
  });

  loginForm.addEventListener("reset", function () {
    emailError.textContent = "";
    passwordError.textContent = "";
    emailInput.removeAttribute("aria-invalid");
    passwordInput.removeAttribute("aria-invalid");
    showLoginMessage("", false);
  });
}
