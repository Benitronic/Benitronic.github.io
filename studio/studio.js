const client=window.supabase.createClient("https://vfyiczqntletivvxvpmo.supabase.co","sb_publishable_radG_i41rNtT3pI_YhXUpg_qbvl5nJO");
const allowed=["faculdadebc1@gmail.com","eng.beniciobarbosa@gmail.com"];
const $=id=>document.getElementById(id);
let publications=[],editing=null;

async function checkSession(){
  const {data:{session}}=await client.auth.getSession();
  const email=session?.user?.email?.toLowerCase();
  const ok=email&&allowed.includes(email);
  $("loginPanel").hidden=!!ok;
  $("manager").hidden=!ok;
  $("signOut").hidden=!ok;
  if(ok)load();
}

$("loginForm").onsubmit=async event=>{
  event.preventDefault();
  $("loginStatus").textContent="Entrando…";
  const {error}=await client.auth.signInWithPassword({email:$("loginEmail").value,password:$("loginPassword").value});
  $("loginStatus").textContent=error?"Não foi possível entrar. Verifique o e-mail e a senha.":"";
  if(!error)checkSession();
};

$("signOut").onclick=async()=>{await client.auth.signOut();location.reload();};

async function load(){
  const {data,error}=await client.from("publications").select("*").order("year",{ascending:false}).order("created_at",{ascending:false});
  if(error){$("items").innerHTML=`<p>Erro ao carregar: ${escapeHtml(error.message)}</p>`;return}
  publications=data||[];
  $("count").textContent=`${publications.length} ${publications.length===1?"registro":"registros"}`;
  $("items").innerHTML=publications.map(publication=>`<article class="${editing?.id===publication.id?"selected":""}"><time>${publication.year}</time><div><small>${escapeHtml(publication.type)}</small><h3>${escapeHtml(publication.title)}</h3><p>${escapeHtml(publication.venue)}</p><div class="record-badges">${publication.featured?'<span class="featured-badge">Destaque</span>':''}${publication.pdf_path?'<span class="pdf-badge">PDF anexado</span>':''}</div></div><div class="manager-actions"><button data-edit="${publication.id}">Editar</button><button class="danger" data-delete="${publication.id}">Excluir</button></div></article>`).join("");
  document.querySelectorAll("[data-edit]").forEach(button=>button.onclick=()=>edit(Number(button.dataset.edit)));
  document.querySelectorAll("[data-delete]").forEach(button=>button.onclick=()=>remove(Number(button.dataset.delete)));
}

function escapeHtml(value=""){return String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));}
function normalizedType(type){return ({"Conference paper":"Artigo em congresso","Journal article":"Artigo","Master's thesis":"Dissertação de mestrado"})[type]||type||"Artigo";}

function edit(id){
  editing=publications.find(publication=>publication.id===id);
  const form=$("publicationForm");
  ["title","authors","venue","year","doi","abstract","featured_order","contribution_pt","contribution_en","complementary_url","complementary_label_pt","complementary_label_en"].forEach(key=>form.elements[key].value=editing[key]??"");
  form.elements.type.value=normalizedType(editing.type);
  form.elements.featured.checked=!!editing.featured;
  $("formTitle").textContent="Editar publicação";
  $("submitButton").textContent="Salvar alterações";
  $("cancelEdit").hidden=false;
  $("removePdfLabel").hidden=!editing.pdf_path;
  $("formStatus").textContent="";
  load();
  form.scrollIntoView({behavior:"smooth"});
}

function reset(){
  editing=null;
  $("publicationForm").reset();
  $("formTitle").textContent="Nova publicação";
  $("submitButton").textContent="Cadastrar publicação";
  $("cancelEdit").hidden=true;
  $("removePdfLabel").hidden=true;
  $("formStatus").textContent="";
  load();
}

$("cancelEdit").onclick=reset;

$("publicationForm").onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget,file=form.elements.pdf.files[0],featured=form.elements.featured.checked;
  if(file&&(file.type!=="application/pdf"||file.size>25*1024*1024)){$("formStatus").textContent="Selecione um PDF de até 25 MB.";return}
  if(featured&&(!form.elements.contribution_pt.value.trim()||!form.elements.contribution_en.value.trim())){$("formStatus").textContent="Preencha a contribuição em português e inglês para uma publicação em destaque.";return}
  $("formStatus").textContent="Salvando…";
  let pdfPath=editing?.pdf_path||null;
  if((form.elements.removePdf.checked&&pdfPath)||file){if(pdfPath)await client.storage.from("publication-pdfs").remove([pdfPath]);pdfPath=null}
  if(file){
    pdfPath=`${Date.now()}-${crypto.randomUUID()}.pdf`;
    const {error}=await client.storage.from("publication-pdfs").upload(pdfPath,file,{contentType:"application/pdf"});
    if(error){$("formStatus").textContent=`Erro no PDF: ${error.message}`;return}
  }
  const nullable=name=>form.elements[name].value.trim()||null;
  const payload={
    title:nullable("title"),authors:nullable("authors"),venue:nullable("venue"),year:Number(form.elements.year.value),type:form.elements.type.value,doi:nullable("doi"),abstract:nullable("abstract"),pdf_path:pdfPath,
    featured,featured_order:featured&&form.elements.featured_order.value?Number(form.elements.featured_order.value):null,
    contribution_pt:featured?nullable("contribution_pt"):null,contribution_en:featured?nullable("contribution_en"):null,
    complementary_url:featured?nullable("complementary_url"):null,complementary_label_pt:featured?nullable("complementary_label_pt"):null,complementary_label_en:featured?nullable("complementary_label_en"):null,
    updated_at:new Date().toISOString()
  };
  const result=editing?await client.from("publications").update(payload).eq("id",editing.id):await client.from("publications").insert(payload);
  if(result.error){$("formStatus").textContent=`Erro: ${result.error.message}`;return}
  $("formStatus").textContent="Publicação salva.";
  setTimeout(reset,700);
};

async function remove(id){
  const publication=publications.find(item=>item.id===id);
  if(!confirm(`Excluir definitivamente “${publication.title}”?`))return;
  if(publication.pdf_path)await client.storage.from("publication-pdfs").remove([publication.pdf_path]);
  const {error}=await client.from("publications").delete().eq("id",id);
  if(error)alert(`Erro: ${error.message}`);else if(editing?.id===id)reset();else load();
}

client.auth.onAuthStateChange(()=>checkSession());
checkSession();
