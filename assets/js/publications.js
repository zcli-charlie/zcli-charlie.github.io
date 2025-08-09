/* Render publications from a JSON file into #pub-root */
(function () {
  function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function createLink(label, href) {
    if (!href) return null;
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  // Very small markdown-to-HTML converter for basic formatting
  function renderMarkdown(md) {
    if (!md) return '';
    // Escape HTML first
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks ```
    html = html.replace(/```([\s\S]*?)```/g, function (_, code) {
      return '<pre><code>' + code.replace(/\n/g, '\n') + '</code></pre>';
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **text** and Italic *text*
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headings #, ##, ###
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Unordered lists
    html = html.replace(/^(\s*)[-*]\s+(.+)$/gm, '$1<li>$2</li>');
    html = html.replace(/(<li>.*<\/li>)(?:(?:\r?\n)+)(?!<li>)/gs, '<ul>$1</ul>\n');

    // Ordered lists
    html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li>$2</li>');
    html = html.replace(/(<li>.*<\/li>)(?:(?:\r?\n)+)(?!<li>)/gs, function (m) { return m; });

    // Paragraphs: wrap isolated lines into <p>
    html = html
      .split(/\n{2,}/)
      .map(block => {
        if (/^\s*<h\d|^\s*<ul|^\s*<pre|^\s*<li|^\s*<p|^\s*<blockquote/.test(block)) {
          return block;
        }
        const lines = block.trim().split(/\n/).filter(Boolean);
        const content = lines.join('<br>');
        return '<p>' + content + '</p>';
      })
      .join('\n');

    return html;
  }

  function slugify(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async function loadPublications() {
    const root = document.getElementById('pub-root');
    if (!root) return;
    const source = root.getAttribute('data-source') || 'assets/data/publications.json';
    const limitAttr = root.getAttribute('data-limit');
    const maxItems = limitAttr ? parseInt(limitAttr, 10) : 0;
    const isFlat = root.getAttribute('data-flat') === 'true';

    try {
      const res = await fetch(source, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch publications');
      const data = await res.json();
      const years = Array.isArray(data.years) ? data.years.slice() : [];
      years.sort((a, b) => Number(b.year) - Number(a.year));

      // If static content exists, hide it to avoid duplication
      document.querySelectorAll('#publications .pub-year, #publications .pub-list').forEach(el => {
        el.style.display = 'none';
      });

      let renderedCount = 0;
      const renderItem = (item, yearLabel) => {
          if (maxItems > 0 && renderedCount >= maxItems) break;
          const li = document.createElement('li');
          const pub = createElement('div', 'pub');

          const title = createElement('span', 'title', item.title || '');
          pub.appendChild(title);

          const linksSpan = createElement('span', 'links');
          const pdf = createLink('PDF', item.pdf);
          const code = createLink('Code', item.code);
          const detailsBtn = createElement('button', 'pub-details-toggle', 'Details');
          const linkFrags = [];
          if (pdf) linkFrags.push(pdf);
          if (code) linkFrags.push(code);
          if (linkFrags.length > 0) {
            // format as [PDF] [Code]
            const open = document.createTextNode(' [');
            linksSpan.appendChild(open);
            linkFrags.forEach((a, idx) => {
              linksSpan.appendChild(a);
              if (idx !== linkFrags.length - 1) linksSpan.appendChild(document.createTextNode('] ['));
            });
            linksSpan.appendChild(document.createTextNode(']'));
            pub.appendChild(linksSpan);
          }

          // Details container (collapsed by default)
          const details = createElement('div', 'pub-details');
          details.hidden = true;
          const detailsInner = createElement('div', 'pub-details-body');
          details.appendChild(detailsInner);

          // Attach toggle button
          detailsBtn.addEventListener('click', async () => {
            if (!details.hasAttribute('data-loaded')) {
              const mdPath = item.md || `assets/pubs/${group.year}/${slugify(item.title)}.md`;
              detailsInner.innerHTML = '<div class="pub-loading">Loading…</div>';
              try {
                const resp = await fetch(mdPath, { cache: 'no-store' });
                if (!resp.ok) throw new Error('Not found');
                const md = await resp.text();
                detailsInner.innerHTML = renderMarkdown(md);
                details.setAttribute('data-loaded', '1');
              } catch (e) {
                detailsInner.innerHTML = '<div class="pub-error">Details not available yet.</div>';
              }
            }
            const willShow = details.hidden;
            details.hidden = !willShow;
            detailsBtn.textContent = willShow ? 'Hide' : 'Details';
          });

          const controls = createElement('div', 'pub-controls');
          controls.appendChild(detailsBtn);
          pub.appendChild(controls);

          if (item.authors) {
            const authors = createElement('div', 'authors', item.authors);
            pub.appendChild(authors);
          }
          if (item.venue) {
            const venueText = yearLabel ? item.venue : item.venue;
            const venue = createElement('div', 'venue', venueText);
            pub.appendChild(venue);
          }

          pub.appendChild(details);
          li.appendChild(pub);
          return li;
      };

      if (isFlat) {
        const flat = [];
        for (const group of years) {
          const items = group.items || [];
          for (const item of items) {
            if (maxItems > 0 && flat.length >= maxItems) break;
            flat.push({ year: group.year, item });
          }
          if (maxItems > 0 && flat.length >= maxItems) break;
        }
        // Sort by year descending already preserved; keep insertion order
        const list = createElement('ol', 'pub-list');
        for (const { year, item } of flat) {
          const li = renderItem(item, String(year));
          list.appendChild(li);
          renderedCount += 1;
          if (maxItems > 0 && renderedCount >= maxItems) break;
        }
        root.appendChild(list);
      } else {
        for (const group of years) {
          const groupItems = group.items || [];
          if (groupItems.length === 0) continue;
          const list = createElement('ol', 'pub-list');
          let groupHasAny = false;
          for (const item of groupItems) {
            const li = renderItem(item, String(group.year));
            list.appendChild(li);
            groupHasAny = true;
            renderedCount += 1;
            if (maxItems > 0 && renderedCount >= maxItems) break;
          }
          if (groupHasAny) {
            const badge = createElement('div', 'pub-year', String(group.year));
            root.appendChild(badge);
            root.appendChild(list);
          }
          if (maxItems > 0 && renderedCount >= maxItems) break;
        }
      }
    } catch (err) {
      const errorBox = createElement('div', 'callout');
      errorBox.textContent = 'Failed to load publications. Please try refreshing the page.';
      root.appendChild(errorBox);
      console.error(err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPublications);
  } else {
    loadPublications();
  }
})();

