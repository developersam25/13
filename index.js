// Listings app with optional backend (http://localhost:3000)
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

const modal = qs('#modal');
const openBtn = qs('#open-add');
const closeBtn = qs('#close-add');
const cancelBtn = qs('#cancel');
const loginModal = qs('#login-modal');
const openLogin = qs('#open-login');
const closeLogin = qs('#close-login');
const loginCancel = qs('#login-cancel');
const loginForm = qs('#login-form');
const authArea = qs('#auth-area');
const manageModal = qs('#manage-modal');
const openManageBtn = null; // created dynamically in auth area
const closeManageBtn = qs('#close-manage');
const manageClose = qs('#manage-close');
const manageList = qs('#manage-list');
let editingId = null;
const form = qs('#property-form');
const imagesInput = qs('#images');
const preview = qs('#preview');
const listingsEl = qs('#listings');
const searchInput = qs('#search');
const filterType = qs('#filter-type');
const filterBeds = qs('#filter-bedrooms');

const API_BASE = 'http://localhost:3000';
let backendAvailable = false;

async function checkBackend(){
	try{
		const r = await fetch(API_BASE + '/api/ping', {mode:'cors'});
		if(r.ok) return true;
	}catch(e){}
	return false;
}

function openModal(){ modal.classList.remove('hidden'); }
let lastFocused = null;
function openModal(){
	lastFocused = document.activeElement;
	modal.classList.remove('hidden');
	modal.setAttribute('aria-hidden','false');
	// focus first input
	const first = modal.querySelector('input,select,textarea,button');
	if(first) first.focus();
}
function closeModal(){
	modal.classList.add('hidden');
	modal.setAttribute('aria-hidden','true');
	form.reset(); preview.innerHTML='';
	if(lastFocused) lastFocused.focus();
}

openBtn.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

imagesInput.addEventListener('change', async (e) => {
	preview.innerHTML='';
	const files = Array.from(e.target.files || []);
	const urls = await Promise.all(files.map(readFile));
	urls.forEach(u => {
		const img = document.createElement('img'); img.src = u; preview.appendChild(img);
	});
});

// close modal with Escape and basic focus trap
document.addEventListener('keydown', (e) => {
	if(e.key === 'Escape' && !modal.classList.contains('hidden')){ closeModal(); }
	if(e.key === 'Tab' && !modal.classList.contains('hidden')){

	function openLoginModal(){ lastFocused = document.activeElement; loginModal.classList.remove('hidden'); loginModal.setAttribute('aria-hidden','false'); const f = loginModal.querySelector('input'); if(f) f.focus(); }
	function closeLoginModal(){ loginModal.classList.add('hidden'); loginModal.setAttribute('aria-hidden','true'); loginForm.reset(); if(lastFocused) lastFocused.focus(); }

	openLogin && openLogin.addEventListener('click', openLoginModal);
	closeLogin && closeLogin.addEventListener('click', closeLoginModal);
	loginCancel && loginCancel.addEventListener('click', closeLoginModal);

	loginForm && loginForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const fd = new FormData(loginForm);
		const username = fd.get('username');
		const password = fd.get('password');
		try{
			// Try login then register fallback
			let r = await fetch(API_BASE + '/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) });
			if(!r.ok){
				r = await fetch(API_BASE + '/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) });
			}
			if(r.ok){
				const data = await r.json();
				localStorage.setItem('homelist_token', data.token);
				updateAuthUI();
				closeLoginModal();
			}else{
				const err = await r.json().catch(()=>({error:'failed'}));
				alert(err.error || 'Auth failed');
			}
		}catch(err){ console.error(err); alert('Auth failed'); }
	});

	function logout(){ localStorage.removeItem('homelist_token'); updateAuthUI(); }

	function updateAuthUI(){
		const token = localStorage.getItem('homelist_token');
		if(!authArea) return;
		authArea.innerHTML = '';
		if(token){
			const out = document.createElement('div');
			out.style.display='flex'; out.style.gap='8px';
			const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Logout'; btn.addEventListener('click', logout);
			const add = document.createElement('button'); add.id='open-add'; add.className='btn btn-primary'; add.textContent='Add Property'; add.addEventListener('click', openModal);
			const manage = document.createElement('button'); manage.id='open-manage'; manage.className='btn'; manage.textContent='Manage'; manage.addEventListener('click', openManage);
			out.appendChild(add); out.appendChild(btn); authArea.appendChild(out);
			authArea.appendChild(manage);
		}else{
			const lbtn = document.createElement('button'); lbtn.id='open-login'; lbtn.className='btn'; lbtn.textContent='Login'; lbtn.addEventListener('click', openLoginModal);
			const add = document.createElement('button'); add.id='open-add'; add.className='btn btn-primary'; add.textContent='Add Property'; add.addEventListener('click', openModal);
			authArea.appendChild(lbtn); authArea.appendChild(add);
		}
	}

	updateAuthUI();

	function openManage(){
		lastFocused = document.activeElement;
		manageModal.classList.remove('hidden');
		manageModal.setAttribute('aria-hidden','false');
		renderManageList();
	}

	function closeManage(){ manageModal.classList.add('hidden'); manageModal.setAttribute('aria-hidden','true'); if(lastFocused) lastFocused.focus(); }

	closeManageBtn && closeManageBtn.addEventListener('click', closeManage);
	manageClose && manageClose.addEventListener('click', closeManage);

	async function renderManageList(){
		const token = localStorage.getItem('homelist_token');
		let list = [];
		try{ list = backendAvailable ? await fetchListingsFromServer() : getLocalListings(); }catch(e){ list = getLocalListings(); }
		manageList.innerHTML = '';
		list.forEach(l => {
			const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between'; row.style.padding='8px 6px'; row.style.borderBottom='1px solid #f1f5f9';
			const left = document.createElement('div'); left.innerHTML = `<strong>${escapeHtml(l.title)}</strong><div style="color:#64748b">${escapeHtml(l.address)} — $${numberWithCommas(l.price)}</div>`;
			const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='6px';
			const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit'; edit.addEventListener('click', ()=> startEdit(l));
			const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.addEventListener('click', ()=> confirmDelete(l.id));
			actions.appendChild(edit); actions.appendChild(del);
			row.appendChild(left); row.appendChild(actions);
			manageList.appendChild(row);
		});
	}

	function startEdit(listing){
		// populate the add form with listing data and set editingId
		editingId = listing.id;
		form.title.value = listing.title || '';
		form.price.value = listing.price || 0;
		form.listingType.value = listing.listingType || 'rent';
		form.beds.value = listing.beds || 0;
		form.description.value = listing.description || '';
		form.address.value = listing.address || '';
		openModal();
	}

	async function confirmDelete(id){
		if(!confirm('Delete this listing?')) return;
		if(backendAvailable){
			const token = localStorage.getItem('homelist_token');
			const res = await fetch(API_BASE + '/api/listings/' + id, { method:'DELETE', headers: token ? { 'Authorization': 'Bearer '+token } : {} });
			if(!res.ok){ alert('Delete failed'); return; }
			await renderManageList(); renderListings();
		}else{
			// localStorage delete
			const list = getLocalListings().filter(x=>x.id!==id);
			saveLocalListings(list); renderManageList(); renderListings();
		}
	}
		const focusable = modal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select');
		if(!focusable.length) return;
		const nodes = Array.from(focusable);
		const idx = nodes.indexOf(document.activeElement);
		if(e.shiftKey && idx === 0){ nodes[nodes.length-1].focus(); e.preventDefault(); }
		else if(!e.shiftKey && idx === nodes.length-1){ nodes[0].focus(); e.preventDefault(); }
	}
});

function readFile(file){
	return new Promise((res, rej) => {
		const fr = new FileReader();
		fr.onload = () => res(fr.result);
		fr.onerror = rej;
		fr.readAsDataURL(file);
	});
}

// Local fallback storage
function getLocalListings(){
	return JSON.parse(localStorage.getItem('home_listings')||'[]');
}
function saveLocalListings(list){
	localStorage.setItem('home_listings', JSON.stringify(list));
}

async function fetchListingsFromServer(){
	const res = await fetch(API_BASE + '/api/listings');
	if(!res.ok) throw new Error('failed');
	return res.json();
}

async function postListingToServer(formData){
	const res = await fetch(API_BASE + '/api/listings', { method: 'POST', body: formData });
	if(!res.ok) throw new Error('failed to POST');
	return res.json();
}

form.addEventListener('submit', async (ev) => {
	ev.preventDefault();
	if(backendAvailable){
		const fd = new FormData();
		const f = new FormData(form);
		['title','price','listingType','beds','description','address'].forEach(k => fd.append(k, f.get(k)));
		const files = imagesInput.files ? Array.from(imagesInput.files) : [];
		files.forEach(file => fd.append('images', file));
		try{
			const token = localStorage.getItem('homelist_token');
			if(editingId){
				// update via PUT (no file upload support here)
				const body = {};
				['title','price','listingType','beds','description','address'].forEach(k=> body[k]=f.get(k));
				const res = await fetch(API_BASE + '/api/listings/' + editingId, { method:'PUT', headers: Object.assign({'Content-Type':'application/json'}, token ? {'Authorization':'Bearer '+token} : {}), body: JSON.stringify(body) });
				if(!res.ok) throw new Error('update failed');
				editingId = null;
			}else{
				const res = await fetch(API_BASE + '/api/listings', { method:'POST', headers: token ? { 'Authorization': 'Bearer '+token } : {}, body: fd });
				if(!res.ok) throw new Error('post failed');
			}
			await renderListings();
			closeModal();
			editingId = null;
			return;
		}catch(err){
			console.warn('Server post failed, falling back to localStorage', err);
		}
	}

	// fallback: save locally (data URLs)
	const fd2 = new FormData(form);
	const title = fd2.get('title').trim();
	const price = Number(fd2.get('price')) || 0;
	const listingType = fd2.get('listingType');
	const beds = Number(fd2.get('beds')) || 0;
	const description = fd2.get('description') || '';
	const address = fd2.get('address') || '';
	const fileList = imagesInput.files ? Array.from(imagesInput.files) : [];
	const images = await Promise.all(fileList.map(readFile));
	const listings = getLocalListings();
	listings.unshift({id:Date.now(),title,price,listingType,beds,description,address,images});
	saveLocalListings(listings);
	renderListings();
	closeModal();
});

async function renderListings(){
	let list = [];
	if(backendAvailable){
		try{ list = await fetchListingsFromServer(); }catch(e){ list = getLocalListings(); }
	}else{
		list = getLocalListings();
	}

	const q = (searchInput.value||'').toLowerCase().trim();
	const type = filterType.value;
	const minBeds = filterBeds.value === 'any' ? 0 : Number(filterBeds.value);

	const filtered = list.filter(l => {
		if(type !== 'all' && l.listingType !== type) return false;
		if(l.beds < minBeds) return false;
		if(q){
			const hay = (l.title+' '+l.address+' '+l.description).toLowerCase();
			if(!hay.includes(q)) return false;
		}
		return true;
	});

	listingsEl.innerHTML = '';
	if(filtered.length === 0){
		listingsEl.innerHTML = '<div class="empty">No listings yet. Click "Add Property" to create one.</div>';
		return;
	}

	filtered.forEach(l => {
		const card = document.createElement('article'); card.className='card';
		const img = document.createElement('img');
		let src = null;
		if (l.images && l.images[0]) {
			src = l.images[0];
			// if server-backed image path is absolute (starts with '/') and backendAvailable, prefix API base
			if (typeof src === 'string' && src.startsWith('/') && backendAvailable) {
				src = API_BASE + src;
			}
		} else {
			src = placeholderData();
		}
		img.src = src;
		card.appendChild(img);
		const bd = document.createElement('div'); bd.className='card-body';
		bd.innerHTML = `
			<div style="display:flex;justify-content:space-between;align-items:center">
				<div><strong>${escapeHtml(l.title)}</strong><div class="meta">${escapeHtml(l.address)}</div></div>
				<div class="price">$${numberWithCommas(l.price)}</div>
			</div>
			<div class="tags">${l.beds} beds · ${l.listingType}</div>
			<p style="margin-top:8px;color:#334155">${escapeHtml(truncate(l.description,120))}</p>
		`;
		card.appendChild(bd);
		listingsEl.appendChild(card);
	});
}

function truncate(s,n){ return s && s.length>n ? s.slice(0,n-1)+'…' : (s||''); }
function numberWithCommas(x){ return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g,","); }
function escapeHtml(str){ return (str||'').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function placeholderData(){
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><rect width='100%' height='100%' fill='%23e6e9ef'/><text x='50%' y='50%' fill='%239aa4b2' font-size='24' font-family='Arial' text-anchor='middle' dominant-baseline='central'>No image</text></svg>`;
	return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// filters
searchInput.addEventListener('input', () => renderListings());
filterType.addEventListener('change', renderListings);
filterBeds.addEventListener('change', renderListings);

// init
(async function(){ backendAvailable = await checkBackend(); renderListings(); })();
// Auto-seed localStorage when no backend and no local listings
function seedLocalListings(){
	const samples = [
		{ id: Date.now()+1, title: 'Sunny Family Home', price: 250000, listingType: 'sale', beds: 4, description: 'Spacious family home with garden and garage. Close to schools and parks.', address: '12 Oak Street, Springfield', images: [placeholderData()] },
		{ id: Date.now()+2, title: 'Modern City Apartment', price: 1800, listingType: 'rent', beds: 2, description: 'Bright modern apartment in the city center with concierge and gym access.', address: '101 Central Ave, Metropolis', images: [placeholderData()] },
		{ id: Date.now()+3, title: 'Cozy Studio', price: 950, listingType: 'rent', beds: 1, description: 'Compact studio perfect for single professionals. Low utilities and great transport.', address: '7 Short Lane, Uptown', images: [placeholderData()] }
	];
	saveLocalListings(samples);
}

(async function(){
	backendAvailable = await checkBackend();
	if(!backendAvailable){
		const existing = getLocalListings();
		if(!existing || existing.length === 0){
			seedLocalListings();
		}
	}
	renderListings();
})();

