const STORAGE_KEY = "randomfood.dishes.v1";
const TABLE_NAME = "dishes";

const addDishForm = document.getElementById("addDishForm");
const dishNameInput = document.getElementById("dishName");
const drawButton = document.getElementById("drawButton");
const drawResult = document.getElementById("drawResult");
const dishTableBody = document.getElementById("dishTableBody");
const dishRowTemplate = document.getElementById("dishRowTemplate");
const emptyState = document.getElementById("emptyState");
const resetDataButton = document.getElementById("resetData");

dishNameInput.addEventListener("invalid", (event) => {
  event.preventDefault();
  alert("Digite o nome do sabor antes de adicionar.");
});

let dishes = [];
let supabaseClient = null;
let isRemoteSyncEnabled = false;

initializeApp();

async function initializeApp() {
  initializeStorageMode();
  dishes = await loadDishes();
  renderDishes();
}

function initializeStorageMode() {
  const hasSupabaseLib = typeof window.supabase !== "undefined";
  const config = window.RANDOMFOOD_CONFIG || {};
  const hasValidConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey);

  if (!hasSupabaseLib || !hasValidConfig) {
    isRemoteSyncEnabled = false;
    return;
  }

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  isRemoteSyncEnabled = true;
}

addDishForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = dishNameInput.value.trim();

  if (!name) {
    alert("Digite um nome de sabor válido.");
    return;
  }

  const newDish = {
    id: crypto.randomUUID(),
    name
  };

  try {
    await createDish(newDish);
    dishes.push(newDish);
    saveDishesToLocal();
    renderDishes();
    addDishForm.reset();
    dishNameInput.focus();
  } catch (error) {
    console.error(error);
    alert("Nao foi possivel adicionar o sabor. Verifique sua conexao e configuracao.");
  }
});

drawButton.addEventListener("click", () => {
  if (dishes.length < 3) {
    drawResult.innerHTML = "<p>Cadastre pelo menos 3 sabores para sortear a semana.</p>";
    return;
  }

  const selected = drawThreeRandomDishes(dishes);

  const listItems = selected
    .map((dish) => `<li><strong>${escapeHtml(dish.name)}</strong></li>`)
    .join("");

  drawResult.innerHTML = `
    <p><strong>Pratos sorteados da semana:</strong></p>
    <ol>${listItems}</ol>
  `;
});

resetDataButton.addEventListener("click", async () => {
  const confirmReset = window.confirm("Tem certeza que deseja apagar todos os sabores?");
  if (!confirmReset) {
    return;
  }

  try {
    await deleteAllDishes();
    dishes = [];
    saveDishesToLocal();
    renderDishes();
    drawResult.innerHTML = "<p>Nenhum sorteio realizado ainda.</p>";
  } catch (error) {
    console.error(error);
    alert("Nao foi possivel limpar os sabores agora.");
  }
});

function renderDishes() {
  dishTableBody.innerHTML = "";

  dishes.forEach((dish) => {
    const row = dishRowTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = row.querySelector(".dish-name-input");
    const removeButton = row.querySelector(".remove-btn");

    nameInput.value = dish.name;

    nameInput.addEventListener("change", async () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        nameInput.value = dish.name;
        alert("O nome do sabor nao pode ficar vazio.");
        return;
      }

      try {
        await updateDishName(dish.id, newName);
        dish.name = newName;
        saveDishesToLocal();
      } catch (error) {
        console.error(error);
        nameInput.value = dish.name;
        alert("Nao foi possivel salvar a edicao do nome.");
      }
    });

    removeButton.addEventListener("click", async () => {
      try {
        await deleteDish(dish.id);
        dishes = dishes.filter((currentDish) => currentDish.id !== dish.id);
        saveDishesToLocal();
        renderDishes();
      } catch (error) {
        console.error(error);
        alert("Nao foi possivel excluir esse sabor.");
      }
    });

    dishTableBody.appendChild(row);
  });

  emptyState.hidden = dishes.length > 0;
  drawButton.disabled = dishes.length < 3;
}

function drawThreeRandomDishes(source) {
  const pool = source.map((dish) => ({ ...dish }));

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, 3);
}

async function loadDishes() {
  if (isRemoteSyncEnabled) {
    try {
      return await fetchRemoteDishes();
    } catch (error) {
      console.error(error);
      alert("Falha ao carregar do Supabase. Dados locais foram usados como fallback.");
      return loadDishesFromLocal();
    }
  }

  return loadDishesFromLocal();
}

function loadDishesFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((dish) => ({
        id: typeof dish.id === "string" ? dish.id : crypto.randomUUID(),
        name: String(dish.name || "").trim()
      }))
      .filter((dish) => dish.name.length > 0);
  } catch {
    return [];
  }
}

function saveDishesToLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dishes));
}

async function fetchRemoteDishes() {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("id, name")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || [])
    .map((dish) => ({
      id: String(dish.id || "").trim(),
      name: String(dish.name || "").trim()
    }))
    .filter((dish) => dish.id && dish.name);
}

async function createDish(dish) {
  if (!isRemoteSyncEnabled) {
    return;
  }

  const { error } = await supabaseClient.from(TABLE_NAME).insert({
    id: dish.id,
    name: dish.name
  });

  if (error) {
    throw error;
  }
}

async function updateDishName(id, name) {
  if (!isRemoteSyncEnabled) {
    return;
  }

  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .update({ name })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

async function deleteDish(id) {
  if (!isRemoteSyncEnabled) {
    return;
  }

  const { error } = await supabaseClient.from(TABLE_NAME).delete().eq("id", id);
  if (error) {
    throw error;
  }
}

async function deleteAllDishes() {
  if (!isRemoteSyncEnabled) {
    return;
  }

  if (dishes.length === 0) {
    return;
  }

  const ids = dishes.map((dish) => dish.id);
  const { error } = await supabaseClient.from(TABLE_NAME).delete().in("id", ids);

  if (error) {
    throw error;
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
