const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const promptInput = document.getElementById("prompt");
const saveBtn = document.getElementById("saveBtn");
const promptList = document.getElementById("promptList");
const searchInput = document.getElementById("search");
const totalCount = document.getElementById("totalCount");
const favoriteCount = document.getElementById("favoriteCount");
const sortSelect = document.getElementById("sortSelect");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const toast = document.getElementById("toast");
loadPrompts();

saveBtn.addEventListener("click", savePrompt);
searchInput.addEventListener("input", loadPrompts);
sortSelect.addEventListener("change", loadPrompts);
function savePrompt() {

    const title = titleInput.value.trim();
    const category = categoryInput.value.trim();
    const prompt = promptInput.value.trim();

    if (!title || !prompt) {
        alert("Please enter a title and prompt.");
        return;
    }

    const newPrompt = {
        id: Date.now(),
        title,
        category,
        prompt,
        favorite: false,
        createdAt: new Date().toLocaleString()
    };

    chrome.storage.local.get(["prompts"], (result) => {

        const prompts = result.prompts || [];

        prompts.unshift(newPrompt);

        chrome.storage.local.set({ prompts }, () => {

            clearInputs();

            loadPrompts();
        });

    });

}

function loadPrompts() {

    chrome.storage.local.get(["prompts"], (result) => {

        const prompts = result.prompts || [];

        const keyword = searchInput.value.toLowerCase();

        const filtered = prompts.filter(p =>

            p.title.toLowerCase().includes(keyword) ||

            p.category.toLowerCase().includes(keyword) ||

            p.prompt.toLowerCase().includes(keyword)

        );

        totalCount.textContent = "Total: " + prompts.length;

        favoriteCount.textContent =
            "Favorites: " +
            prompts.filter(p => p.favorite).length;

        promptList.innerHTML = "";

        if(filtered.length===0){

            promptList.innerHTML="<p>No matching prompts.</p>";

            return;

        }

        const sortValue = sortSelect.value;

switch(sortValue){

    case "oldest":
        filtered.sort((a,b)=>a.id-b.id);
        break;

    case "az":
        filtered.sort((a,b)=>a.title.localeCompare(b.title));
        break;

    case "za":
        filtered.sort((a,b)=>b.title.localeCompare(a.title));
        break;

    default:
        filtered.sort((a,b)=>b.id-a.id);
}

        filtered.forEach(prompt=>{

            const card=document.createElement("div");

            card.className="card";

            card.innerHTML=`

                <h3>${prompt.title}</h3>

                <small>${prompt.category||"General"}</small>

                <p>${prompt.prompt}</p>

                <span>${prompt.createdAt}</span>

                <div class="actions">

                    <button class="copyBtn">📋</button>

                    <button class="favoriteBtn ${prompt.favorite ? "active":""}">⭐</button>

                    <button class="editBtn">✏</button>

                    <button class="deleteBtn">🗑</button>

                </div>

            `;


            card.querySelector(".copyBtn").onclick=()=>{

                navigator.clipboard.writeText(prompt.prompt);
                showToast("Prompt copied!");

            };

            card.querySelector(".deleteBtn").onclick=()=>{

                deletePrompt(prompt.id);

            };

            card.querySelector(".editBtn").onclick=()=>{

                editPrompt(prompt.id);

            };

            card.querySelector(".favoriteBtn").onclick=()=>{

                toggleFavorite(prompt.id);

            };

            promptList.appendChild(card);

        });

    });

}

function clearInputs() {

    titleInput.value = "";
    categoryInput.value = "";
    promptInput.value = "";

}
function deletePrompt(id) {

    chrome.storage.local.get(["prompts"], (result) => {

        const prompts = result.prompts.filter(p => p.id !== id);

        chrome.storage.local.set({ prompts }, () => {

            loadPrompts();

        });

    });

}



function editPrompt(id) {

    chrome.storage.local.get(["prompts"], (result) => {

        const prompts = result.prompts;

        const prompt = prompts.find(p => p.id === id);

        titleInput.value = prompt.title;

        categoryInput.value = prompt.category;

        promptInput.value = prompt.prompt;

        deletePrompt(id);

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    });

}
function toggleFavorite(id){

    chrome.storage.local.get(["prompts"],(result)=>{

        const prompts=result.prompts;

        const prompt=prompts.find(p=>p.id===id);

        prompt.favorite=!prompt.favorite;

        chrome.storage.local.set({prompts},()=>{

            loadPrompts();

        });

    });

}

function showToast(message){

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(()=>{

        toast.classList.remove("show");

    },2000);

}

exportBtn.addEventListener("click",()=>{

    chrome.storage.local.get(["prompts"],(result)=>{

        const blob = new Blob(

            [JSON.stringify(result.prompts||[],null,2)],

            {type:"application/json"}

        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;

        a.download = "ai-prompts.json";

        a.click();

        URL.revokeObjectURL(url);

        showToast("Export complete!");

    });

});

importBtn.addEventListener("click",()=>{

    importFile.click();

});

importFile.addEventListener("change",(e)=>{

    const file = e.target.files[0];

    if(!file) return;

    const reader = new FileReader();

    reader.onload = ()=>{

        try{

            const prompts = JSON.parse(reader.result);

            chrome.storage.local.set({prompts},()=>{

                loadPrompts();

                showToast("Import successful!");

            });

        }catch{

            alert("Invalid JSON file.");

        }

    };

    reader.readAsText(file);

});