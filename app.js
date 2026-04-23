import { db } from "./firebase.js";
import {
  ref, push, onValue, query, orderByChild, equalTo, get, update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ── HELPER: Days since last donation ────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return 999;
  const last = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  return diff;
}

// ── HELPER: Capitalize ───────────────────────────────────────
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── TOGGLE EDIT SECTION ─────────────────────────────────────
window.toggleEditSection = function () {
  const section = document.getElementById("editSection");
  section.style.display = section.style.display === "none" ? "block" : "none";
};

// ── REGISTER DONOR ──────────────────────────────────────────
window.registerDonor = async function () {
  const name        = document.getElementById("name").value.trim();
  const age         = document.getElementById("age").value.trim();
  const bloodGroup  = document.getElementById("bloodGroup").value;
  const city        = document.getElementById("city").value.trim().toLowerCase();
  const phone       = document.getElementById("phone").value.trim();
  const lastDonated = document.getElementById("lastDonated").value;
  const status      = document.getElementById("status").value;
  const msg         = document.getElementById("msg");

  if (!name || !age || !bloodGroup || !city || !phone) {
    msg.textContent = "⚠️ Please fill in all required fields.";
    msg.style.color = "orange";
    return;
  }

  msg.textContent = "⏳ Checking...";
  msg.style.color = "gray";

  try {
    // Check duplicate phone
    const snapshot = await get(ref(db, "donors"));
    if (snapshot.exists()) {
      let alreadyRegistered = false;
      snapshot.forEach((child) => {
        if (child.val().phone === phone) {
          alreadyRegistered = true;
        }
      });

      if (alreadyRegistered) {
        msg.textContent = "⚠️ This phone number is already registered! Use 'Update Profile' below to update your details.";
        msg.style.color = "orange";
        // Auto show edit section
        document.getElementById("editSection").style.display = "block";
        document.getElementById("editPhone").value = phone;
        return;
      }
    }

    // Calculate next eligible date
    const days = daysSince(lastDonated);
    let autoStatus = status;
    if (lastDonated && days < 90) {
      autoStatus = "unavailable";
    }

    await push(ref(db, "donors"), {
      name,
      age,
      bloodGroup,
      city,
      phone,
      lastDonated: lastDonated || "Never",
      status: autoStatus,
      totalDonations: lastDonated ? 1 : 0,
      timestamp: Date.now()
    });

    msg.textContent = "✅ Registered successfully! Thank you for joining BloodSOS!";
    msg.style.color = "green";

    // Clear form
    document.getElementById("name").value = "";
    document.getElementById("age").value = "";
    document.getElementById("bloodGroup").value = "";
    document.getElementById("city").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("lastDonated").value = "";
    document.getElementById("status").value = "available";

  } catch (err) {
    msg.textContent = "❌ Error: " + err.message;
    msg.style.color = "red";
  }
};

// ── UPDATE PROFILE ──────────────────────────────────────────
window.updateProfile = async function () {
  const phone       = document.getElementById("editPhone").value.trim();
  const status      = document.getElementById("editStatus").value;
  const lastDonated = document.getElementById("editLastDonated").value;
  const msg         = document.getElementById("editMsg");

  if (!phone) {
    msg.textContent = "⚠️ Please enter your phone number.";
    msg.style.color = "orange";
    return;
  }

  msg.textContent = "⏳ Updating...";
  msg.style.color = "gray";

  try {
    const snapshot = await get(ref(db, "donors"));
    let found = false;
    let donorKey = null;
    let currentDonations = 0;
    let oldLastDonated = "";

    snapshot.forEach((child) => {
      if (child.val().phone === phone) {
        found = true;
        donorKey = child.key;
        currentDonations = child.val().totalDonations || 0;
        oldLastDonated = child.val().lastDonated || "Never";
      }
    });

    if (!found) {
      msg.textContent = "❌ Phone number not found. Please register first.";
      msg.style.color = "red";
      return;
    }

    // Check if this is a new donation (date changed)
    let newTotalDonations = currentDonations;
    if (lastDonated && lastDonated !== oldLastDonated) {
      newTotalDonations = currentDonations + 1;
    }

    // Auto set unavailable if donated less than 90 days ago
    const days = daysSince(lastDonated);
    let autoStatus = status;
    if (lastDonated && days < 90) {
      autoStatus = "unavailable";
      msg.textContent = `⏳ You donated ${days} days ago. You'll be eligible again in ${90 - days} days. Status set to Not Available.`;
      msg.style.color = "orange";
    }

    await update(ref(db, `donors/${donorKey}`), {
      status: autoStatus,
      lastDonated: lastDonated || oldLastDonated,
      totalDonations: newTotalDonations,
      updatedAt: Date.now()
    });

    if (days >= 90 || !lastDonated) {
      msg.textContent = `✅ Profile updated! Total donations: ${newTotalDonations} 🩸`;
      msg.style.color = "green";
    }

    document.getElementById("editPhone").value = "";
    document.getElementById("editLastDonated").value = "";

  } catch (err) {
    msg.textContent = "❌ Error: " + err.message;
    msg.style.color = "red";
  }
};

// ── SEARCH DONORS ───────────────────────────────────────────
window.searchDonors = function () {
  const bloodGroup = document.getElementById("searchBlood").value;
  const city       = document.getElementById("searchCity").value.trim().toLowerCase();
  const resultsDiv = document.getElementById("results");

  if (!bloodGroup) {
    resultsDiv.innerHTML = "<p style='color:orange'>⚠️ Please select a blood group.</p>";
    return;
  }

  resultsDiv.innerHTML = "<p>🔍 Searching...</p>";

  const donorsRef = query(
    ref(db, "donors"),
    orderByChild("bloodGroup"),
    equalTo(bloodGroup)
  );

  onValue(donorsRef, (snapshot) => {
    if (!snapshot.exists()) {
      resultsDiv.innerHTML = "<p>😔 No donors found for this blood group.</p>";
      return;
    }

    let html = "";
    let count = 0;

    snapshot.forEach((child) => {
      const d = child.val();
      if (city && d.city !== city) return;

      // Only show available donors
      if (d.status === "unavailable") return;

      const days = daysSince(d.lastDonated);
      const nextEligible = d.lastDonated && d.lastDonated !== "Never"
        ? (days >= 90 ? "✅ Eligible Now" : `⏳ Eligible in ${90 - days} days`)
        : "✅ Eligible Now";

      count++;
      html += `
        <div class="donor-card">
          <h3>🩸 ${d.name}</h3>
          <p><strong>Blood Group:</strong> ${d.bloodGroup}</p>
          <p><strong>City:</strong> ${capitalize(d.city)}</p>
          <p><strong>Age:</strong> ${d.age} years</p>
          <p><strong>Last Donated:</strong> ${d.lastDonated || "Never"}</p>
          <p><strong>Total Donations:</strong> ${d.totalDonations || 0} 🩸</p>
          <p><strong>Next Eligible:</strong> ${nextEligible}</p>
          <a href="tel:${d.phone}">📞 Call ${d.phone}</a>
        </div>`;
    });

    resultsDiv.innerHTML = count > 0
      ? `<p style="color:green;font-weight:bold">✅ ${count} available donor(s) found:</p>` + html
      : "<p>😔 No available donors found. Try searching without city filter.</p>";

  }, { onlyOnce: true });
};

// ── SEND SOS ────────────────────────────────────────────────
window.sendSOS = async function () {
  const name       = document.getElementById("sosName").value.trim();
  const bloodGroup = document.getElementById("sosBlood").value;
  const hospital   = document.getElementById("sosHospital").value.trim();
  const city       = document.getElementById("sosCity").value.trim().toLowerCase();
  const phone      = document.getElementById("sosPhone").value.trim();
  const note       = document.getElementById("sosNote").value.trim();
  const msg        = document.getElementById("sosMsg");

  if (!name || !bloodGroup || !hospital || !city || !phone) {
    msg.textContent = "⚠️ Please fill in all required fields.";
    msg.style.color = "orange";
    return;
  }

  try {
    await push(ref(db, "sos"), {
      name, bloodGroup, hospital, city, phone, note, timestamp: Date.now()
    });
    msg.textContent = "🚨 SOS Alert sent! Donors will contact you soon.";
    msg.style.color = "green";

    document.getElementById("sosName").value = "";
    document.getElementById("sosBlood").value = "";
    document.getElementById("sosHospital").value = "";
    document.getElementById("sosCity").value = "";
    document.getElementById("sosPhone").value = "";
    document.getElementById("sosNote").value = "";

  } catch (err) {
    msg.textContent = "❌ Error: " + err.message;
    msg.style.color = "red";
  }
};