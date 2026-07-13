from git_filter_repo import FilteringOptions, RepoFilter

REMOVE_DIRS = {
    b".claude",
    b"graphify-out",
    b"vault-update",
    b"test-fixtures",
}

REMOVE_FILES = {
    b"AGENTS.md",
    b"AI.md",
    b"CLAUDE.md",
    b"AUDIT.md",
    b"find_unclosed_tmp.js",
    b"server.log",
}

def filename_callback(filename):
    name = filename.split(b"/")[-1]

    # cartelle
    for d in REMOVE_DIRS:
        if filename == d or filename.startswith(d + b"/"):
            return None

    # file precisi
    if name in REMOVE_FILES:
        return None

    # file temporanei
    if name.startswith(b".tmp_"):
        return None

    # journal
    if name.startswith(b"JOURNAL_"):
        return None

    # test
    if name.startswith(b"test-"):
        return None

    return filename

args = FilteringOptions.default_options()
args.filename_callback = filename_callback
RepoFilter(args).run()