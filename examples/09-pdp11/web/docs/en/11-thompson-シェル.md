# 11. Thompson Shell Usage <a class="qr-link" href="../../../docs/09-PDP11/img/11-en-QR.png">QR</a>

The `/bin/sh` in Unix V6 is the earliest shell, written by Ken Thompson.
It is simpler and easier to learn than the Bourne shell (V7) or bash.

---

## 1. Basic Operations

```text
# pwd                    ← display current directory
# ls                     ← list files
# ls -l                  ← long listing (permissions, size)
# ls -la                 ← include hidden files
# chdir /usr/sys/ken     ← change directory (V6 uses chdir, not cd)
# cat file.txt           ← display file
# echo hello world       ← print string
```

---

## 2. Redirection

```text
# echo hello > out.txt        ← redirect stdout to file
# echo world >> out.txt       ← append
# cat < in.txt                ← redirect stdin from file
# ls -l 2> err.txt            ← redirect stderr to file (2> not supported in V6; use >/dev/null instead)
```

---

## 3. Pipes

Connect multiple commands with `|`.

```text
# ls /bin | wc -l             ← count files in /bin
# cat /etc/passwd | grep root ← find root entry
# ls -l /usr/sys/ken | sort   ← sort output
```

---

## 4. Background Execution

```text
# dc &                        ← launch in background
# ps -ag                      ← verify in process list
```

---

## 5. Shell Variables

```text
# x=hello
# echo $x
hello
# path=/usr/bin
# ls $path
```

Note that unquoted variables are fragile with spaces.

---

## 6. Control Structures

The Thompson shell has control structures for scripting.

### if

```text
if test -f file.c
then
    echo "exists"
fi
```

### for

```text
for f in *.c
do
    echo $f
done
```

### while

```text
while test -f lock
do
    sleep 1
done
```

---

## 7. Shell Scripts

Write to a file and execute.

```text
# cat > hello.sh
echo Hello from shell script
date
^D
# chmod 755 hello.sh
# ./hello.sh
Hello from shell script
Thu Jan  1 00:00:00 1970
```

---

## 8. The `test` Command

Used for conditional evaluation.

| Expression | Meaning |
|----|------|
| `test -f file` | file exists |
| `test -d dir` | directory exists |
| `test -r file` | readable |
| `test s1 = s2` | strings are equal |
| `test n1 -eq n2` | integers are equal |
| `test n1 -lt n2` | n1 < n2 |

---

## 9. Common Command Combinations

```text
# ls /usr/sys/ken | grep '\.c$'      ← .c files only
# cat /etc/passwd | sort           ← sort and display password file
# echo 'main(){printf("x");}' | cc  ← compile from pipe
# od -c /bin/sh | grep 'S H E L'    ← binary search
```

---

## 10. Key Differences from Bourne Shell / bash

| Feature | Thompson sh | Bourne sh / bash |
|------|------------|-----------------|
| Function definitions | None | Supported |
| `$()` command substitution | None (`` ` ` `` only) | Supported |
| Arrays | None | Supported (bash only) |
| `[[...]]` | None | Supported (bash only) |
| `2>` redirection | Not supported | Supported |
| `set -e` | Not supported | Supported |

---

## 11. References

- [10 Unix V6 Command Reference](?doc=10-unix-v6-コマンドリファレンス.md) — individual command details
- [06 Demo Commands](?doc=06-unix-v6-demo-commands.md) — demo scenarios
- [Unix V6 sh(1) manual (TUHS)](https://www.tuhs.org/cgi-bin/utree.pl?act=get&file=V6/usr/man/man1/sh.1)
