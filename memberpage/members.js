const memberForm = document.getElementById("memberForm");
const memberRows = document.getElementById("memberRows");
const memberCount = document.getElementById("memberCount");
const memberSearch = document.getElementById("memberSearch");
const emptyState = document.getElementById("emptyState");
const formMessage = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");
const cancelButton = document.getElementById("cancelButton");
const memberDialog = document.getElementById("memberDialog");
const pageMessage = document.getElementById("pageMessage");

let members = [];
let editingMemberId = null;
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

function showMessage(message, isSuccess) {
  formMessage.textContent = message;
  formMessage.classList.toggle("success", isSuccess);
  if (!memberDialog.open) {
    pageMessage.textContent = message;
    pageMessage.classList.toggle("success", isSuccess);
  }
}

function loadMembers() {
  const savedMembers = localStorage.getItem("libraryMembers");

  if (savedMembers === null) {
    return [];
  }

  const parsedMembers = JSON.parse(savedMembers);
  if (!Array.isArray(parsedMembers)) {
    throw new Error("Saved member records are not a list.");
  }

  const recordsAreValid = parsedMembers.every(function (member) {
    return member &&
      typeof member.memberId === "string" &&
      typeof member.name === "string" &&
      typeof member.email === "string" &&
      typeof member.mobile === "string";
  });
  if (!recordsAreValid) {
    throw new Error("Saved member records contain invalid data.");
  }
  return parsedMembers;
}

try {
  members = loadMembers();
} catch (error) {
  console.error("Could not load member records from local storage.", error);
  showMessage("Member records could not be loaded. Check browser storage and reload.", false);
  storageAvailable = false;
  saveButton.disabled = true;
}

function renderMembers() {
  const searchTerm = memberSearch.value.trim().toLowerCase();
  const filteredMembers = members.filter(function (member) {
    return [member.memberId, member.name, member.email, member.mobile]
      .some(function (value) {
        return value.toLowerCase().includes(searchTerm);
      });
  });
  const rows = filteredMembers.map(function (member) {
    const row = document.createElement("tr");

    [member.memberId, member.name, member.email, member.mobile].forEach(function (value) {
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
    editButton.setAttribute("aria-label", `Edit ${member.name}`);
    editButton.addEventListener("click", function () {
      startEditing(member.memberId);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "action-button delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${member.name}`);
    deleteButton.addEventListener("click", function () {
      deleteMember(member.memberId);
    });

    actions.append(editButton, deleteButton);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    return row;
  });

  memberRows.replaceChildren(...rows);
  memberCount.textContent = searchTerm
    ? `${filteredMembers.length} of ${members.length} members`
    : `${members.length} ${members.length === 1 ? "member" : "members"}`;
  emptyState.textContent = members.length === 0
    ? "No members added yet."
    : "No members match your search.";
  emptyState.hidden = filteredMembers.length > 0;
}

function persistMembers(updatedMembers) {
  try {
    localStorage.setItem("libraryMembers", JSON.stringify(updatedMembers));
    members = updatedMembers;
    renderMembers();
    return true;
  } catch (error) {
    console.error("Could not save member records to local storage.", error);
    showMessage("Unable to save members. Check browser storage and try again.", false);
    return false;
  }
}

function startEditing(memberId) {
  const member = members.find(function (item) {
    return item.memberId === memberId;
  });

  if (!member) {
    showMessage("That member record could not be found.", false);
    return;
  }

  document.getElementById("memberId").value = member.memberId;
  document.getElementById("name").value = member.name;
  document.getElementById("email").value = member.email;
  document.getElementById("mobile").value = member.mobile;
  editingMemberId = memberId;
  document.getElementById("formTitle").textContent = "Update a member";
  saveButton.textContent = "Save Changes";
  cancelButton.hidden = false;
  pageMessage.textContent = "";
  showMessage("", false);
  memberDialog.showModal();
  document.getElementById("memberId").focus();
}

function resetForm() {
  memberForm.reset();
  editingMemberId = null;
  document.getElementById("formTitle").textContent = "Add a member";
  saveButton.textContent = "Add Member";
  cancelButton.hidden = true;
}

function openAddDialog() {
  resetForm();
  showMessage("", false);
  pageMessage.textContent = "";
  memberDialog.showModal();
  document.getElementById("memberId").focus();
}

function deleteMember(memberId) {
  const memberIndex = members.findIndex(function (member) {
    return member.memberId === memberId;
  });

  if (memberIndex === -1) {
    showMessage("That member record could not be found.", false);
    return;
  }

  const updatedMembers = members.slice();
  updatedMembers.splice(memberIndex, 1);
  if (persistMembers(updatedMembers)) {
    if (editingMemberId === memberId) {
      resetForm();
    }
    showMessage("Member deleted.", true);
  }
}

memberForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (!storageAvailable) {
    showMessage("Member management is unavailable because records could not be loaded.", false);
    return;
  }

  const memberId = document.getElementById("memberId").value.trim();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobilePattern = /^[0-9]{10}$/;

  if (!memberId || !name || !email || !mobile) {
    showMessage("Complete all member fields.", false);
    return;
  }

  if (!emailPattern.test(email)) {
    showMessage("Enter a valid email address.", false);
    return;
  }

  if (!mobilePattern.test(mobile)) {
    showMessage("Enter a valid mobile number.", false);
    return;
  }

  const duplicateId = members.some(function (member) {
    return member.memberId.toLowerCase() === memberId.toLowerCase() &&
      member.memberId !== editingMemberId;
  });
  if (duplicateId) {
    showMessage("That Member ID is already in use.", false);
    return;
  }

  const duplicateEmail = members.some(function (member) {
    return member.email.toLowerCase() === email.toLowerCase() &&
      member.memberId !== editingMemberId;
  });
  if (duplicateEmail) {
    showMessage("That email address is already assigned to a member.", false);
    return;
  }

  const wasEditing = editingMemberId !== null;
  let updatedMembers;

  if (wasEditing) {
    const memberIndex = members.findIndex(function (member) {
      return member.memberId === editingMemberId;
    });
    if (memberIndex === -1) {
      showMessage("The member being edited could not be found.", false);
      resetForm();
      return;
    }
    const updatedMember = Object.assign({}, members[memberIndex], {
      memberId,
      name,
      email,
      mobile,
      updatedAt: new Date().toISOString()
    });
    updatedMembers = members.slice();
    updatedMembers.splice(memberIndex, 1, updatedMember);
  } else {
    const updatedMember = {
      memberId,
      name,
      email,
      mobile,
      createdAt: new Date().toISOString()
    };
    updatedMembers = members.slice();
    updatedMembers.push(updatedMember);
  }

  if (persistMembers(updatedMembers)) {
    resetForm();
    memberDialog.close();
    showMessage(wasEditing ? "Member updated." : "Member added.", true);
  }
});

cancelButton.addEventListener("click", function () {
  resetForm();
  showMessage("", false);
  memberDialog.close();
});

document.getElementById("addMemberButton").addEventListener("click", openAddDialog);
document.getElementById("closeDialogButton").addEventListener("click", function () {
  memberDialog.close();
});

memberDialog.addEventListener("click", function (event) {
  if (event.target === memberDialog) {
    memberDialog.close();
  }
});

memberDialog.addEventListener("close", function () {
  if (editingMemberId !== null) {
    resetForm();
  }
});

memberSearch.addEventListener("input", renderMembers);

document.getElementById("logoutButton").addEventListener("click", function () {
  localStorage.removeItem("currentUser");
  window.location.replace("../loginpage/login.html");
});

renderMembers();
