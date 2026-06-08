async function run() {
  try {
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "password" })
    });
    const cookie = loginRes.headers.get("set-cookie");
    
    const res = await fetch("http://localhost:5000/api/parties", {
      headers: { "cookie": cookie }
    });
    
    if (!res.ok) {
      console.error("Error fetching parties:", res.status, await res.text());
    } else {
      const data = await res.json();
      console.log("Parties count:", data.length);
      console.log("First party:", data[0]);
    }
  } catch (e) {
    console.error(e);
  }
}
run();
