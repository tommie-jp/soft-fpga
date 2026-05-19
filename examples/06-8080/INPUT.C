/* INPUT.C */
main()
{
    int c;
    printf("Name: ");
    while ((c = getchar()) != '\r')   /* CP/M uses CR as line terminator */
        putchar(c);
    putchar('\n');
}
