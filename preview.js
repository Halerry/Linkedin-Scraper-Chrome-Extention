chrome.runtime.onMessage.addListener((msg)=>{
  if(msg.type !== 'showPreview') return;
  const d = msg.data;
  document.getElementById('name').textContent = d.name || '';
  const img = document.getElementById('photo');
  if(d.photo){ img.src = d.photo; img.style.display='block'} else { img.style.display='none'; }

  const fill = (tbl, arr, cols) => {
    tbl.innerHTML = '<tr>' + cols.map(c => '<th>'+c+'</th>').join('') + '</tr>' +
      arr.map(o => '<tr>' + cols.map(c=>'<td>'+ (o[c]||'') +'</td>').join('') + '</tr>').join('');
  };
  fill(document.getElementById('exp'), d.experience||[], ['title','company','date']);
  fill(document.getElementById('edu'), d.education||[], ['school','degree','date']);
  document.getElementById('skills').innerHTML = (d.skills||[]).map(s=>'<li>'+s+'</li>').join('');

  document.getElementById('saveLocal').onclick = () => {
    chrome.storage.local.get({ profiles: [] }, (res) => {
    const list = res.profiles;

    const already = list.some(p =>
      (p.profileUrl && d.profileUrl && p.profileUrl === d.profileUrl) ||
      (!p.profileUrl && p.name === d.name)
    );
    if (already) {
      alert('Profile already saved 🗂️');
      return;
    }
    list.push(d);
    chrome.storage.local.set({ profiles: list }, () => {
      alert('Profile saved to local storage ✔️');
    });
  });
  };
});
