/* STRING.C */
main()
{
    char buf[64];
    int i, len;

    strcpy(buf, "CP/M-80");
    len = strlen(buf);
    printf("Length: %d\n", len);

    for (i = 0; i < len; i++)
        buf[i] = toupper(buf[i]);
    printf("Upper: %s\n", buf);
}
