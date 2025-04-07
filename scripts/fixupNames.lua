
local function find_json_files(dir, results)
  results = results or {}
  local uv = vim.loop
  local function scan(path)
    local req = uv.fs_scandir(path)
    if not req then return end
    while true do
      local name, t = uv.fs_scandir_next(req)
      if not name then break end
      local full_path = path .. "/" .. name
      if t == "file" and name:match("%.json$") then
        table.insert(results, full_path)
      elseif t == "directory" then
        scan(full_path)
      end
    end
  end
  scan(dir)
  return results
end

-- Example usage:
local files = find_json_files("raw/regions")
for _, fn in ipairs(files) do
    local ii = 0
    local lines = vim.fn.readfile(fn)
    for i = 1, #lines do
        local line = lines[i]

        local l1 = "pos: "
        local l2 = "region: "
        local l3 = "room: "
        if
            string.sub(line, 1, #l1) == l1
            and lines[i + 3] and string.sub(lines[i + 3], 1, #l1) == l1
            and string.sub(lines[i + 1], 1, #l2) == l2
            and string.sub(lines[i + 2], 1, #l3) == l3
        then
            ii = ii + 1
            lines[i + 1] = "destRegion" .. string.sub(lines[i + 1], #("region") + 1)
            lines[i + 2] = "destRoom" .. string.sub(lines[i + 2], #("room") + 1)
            lines[i + 3] = "destPos" .. string.sub(lines[i + 3], #("pos") + 1)
        end
    end

    local file = io.open(fn, "w")
    if not file then
        error("Could not open file for writing: " .. fn)
    end
    file:write(table.concat(lines, '\r\n') .. '\r\n')
    file:close()
end

