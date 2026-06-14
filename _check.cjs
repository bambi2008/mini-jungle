const http = require('http');
http.get('http://localhost:3000/', (res) => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    const re = /<section id="product-([^"]+)"[^>]*>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const sectionId = m[1];
      // Find the closing </section> by counting
      const start = m.index;
      let depth = 1, pos = start + m[0].length;
      while (depth > 0 && pos < html.length) {
        const nextOpen = html.indexOf('<section', pos);
        const nextClose = html.indexOf('</section>', pos);
        if (nextClose < 0) break;
        if (nextOpen >= 0 && nextOpen < nextClose) { depth++; pos = nextOpen + 8; }
        else { depth--; pos = nextClose + 10; }
      }
      const sectionHtml = html.substring(start, pos);
      const cards = (sectionHtml.match(/class="variant-card"/g) || []).length;
      const opens = (sectionHtml.match(/<div/g) || []).length;
      const closes = (sectionHtml.match(/<\/div>/g) || []).length;
      console.log('product-' + sectionId + ': ' + cards + ' cards, divs open=' + opens + ' close=' + closes + ' diff=' + (opens - closes));
    }
  });
});
