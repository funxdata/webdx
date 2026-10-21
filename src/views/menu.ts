export const menu_tpl = `
    <a class="Title" href="/">FunxData WebDX</a>
    <% it.tabledata.forEach(function(rowitem){ %>
    <div class="Section"><%=rowitem.title%></div>
    <% rowitem.child.forEach(function(routinfo){ %>
        <a class="Example" href="<%=routinfo.path%>"><%=routinfo.title%></a>
    <% }) }) %>
`;
